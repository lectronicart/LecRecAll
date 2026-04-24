import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import getDatabase from '../db/index.js';
import { extractFromUrl, createNoteContent } from '../extractors/index.js';
import { enrichCard } from '../services/enrichment.js';

const router = Router();

// POST /api/cards — Create card from URL or text
router.post('/', async (req: Request, res: Response) => {
  try {
    const { url, content, title, source_type } = req.body;

    if (!url && !content) {
      return res.status(400).json({ error: 'Either url or content is required' });
    }

    const cardId = uuidv4();
    let extracted;

    if (url) {
      // Extract content from URL
      try {
        extracted = await extractFromUrl(url);
      } catch (error: any) {
        return res.status(422).json({ error: `Failed to extract content: ${error.message}` });
      }
    } else {
      // Create from raw text/note
      extracted = createNoteContent(title || 'Untitled Note', content!);
    }

    // Override with user-provided values
    if (title) extracted.title = title;
    if (source_type) extracted.source_type = source_type;

    const db = getDatabase();
    db.prepare(`
      INSERT INTO cards (id, title, url, source_type, content_raw, content_markdown, thumbnail_url, favicon_url, author, published_date, word_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      cardId,
      extracted.title,
      url || null,
      extracted.source_type,
      extracted.content,
      extracted.markdown,
      extracted.thumbnail_url,
      extracted.favicon_url,
      extracted.author,
      extracted.published_date,
      extracted.word_count,
    );

    // Return immediately, enrich in background
    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(cardId);
    res.status(201).json(card);

    // Fire-and-forget enrichment
    enrichCard(cardId).catch(err => console.error('Enrichment error:', err));
  } catch (error: any) {
    console.error('Error creating card:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/cards — List cards with filters
router.get('/', (req: Request, res: Response) => {
  try {
    const { search, tag, source_type, sort = 'newest', page = '1', limit = '20' } = req.query;
    const db = getDatabase();
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let query = `
      SELECT DISTINCT c.*
      FROM cards c
      LEFT JOIN card_tags ct ON c.id = ct.card_id
      LEFT JOIN tags t ON ct.tag_id = t.id
      WHERE c.is_deleted = 0
    `;
    const params: any[] = [];

    if (search) {
      query += ` AND c.id IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)`;
      params.push(search);
    }

    if (tag) {
      query += ` AND t.name = ?`;
      params.push(tag);
    }

    if (source_type) {
      query += ` AND c.source_type = ?`;
      params.push(source_type);
    }

    // Sorting
    switch (sort) {
      case 'oldest':
        query += ` ORDER BY c.created_at ASC`;
        break;
      case 'title':
        query += ` ORDER BY c.title ASC`;
        break;
      case 'most_connected':
        query = `
          SELECT c.*, COALESCE(conn_count, 0) as connection_count
          FROM cards c
          LEFT JOIN (
            SELECT card_id_a as cid, COUNT(*) as conn_count FROM connections GROUP BY card_id_a
            UNION ALL
            SELECT card_id_b as cid, COUNT(*) as conn_count FROM connections GROUP BY card_id_b
          ) conn ON c.id = conn.cid
          LEFT JOIN card_tags ct ON c.id = ct.card_id
          LEFT JOIN tags t ON ct.tag_id = t.id
          WHERE c.is_deleted = 0
          ${search ? 'AND c.id IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)' : ''}
          ${tag ? 'AND t.name = ?' : ''}
          ${source_type ? 'AND c.source_type = ?' : ''}
          GROUP BY c.id
          ORDER BY connection_count DESC
        `;
        break;
      default:
        query += ` ORDER BY c.created_at DESC`;
    }

    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit as string), offset);

    const cards = db.prepare(query).all(...params);

    // Attach tags to each card
    const tagQuery = db.prepare(`
      SELECT t.* FROM tags t JOIN card_tags ct ON t.id = ct.tag_id WHERE ct.card_id = ?
    `);
    for (const card of cards as any[]) {
      card.tags = tagQuery.all(card.id);
      card.key_takeaways = card.key_takeaways ? JSON.parse(card.key_takeaways) : [];
    }

    // Get total count
    const countQuery = `SELECT COUNT(DISTINCT c.id) as total FROM cards c LEFT JOIN card_tags ct ON c.id = ct.card_id LEFT JOIN tags t ON ct.tag_id = t.id WHERE c.is_deleted = 0`;
    const { total } = db.prepare(countQuery).get() as any;

    res.json({ cards, total, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch (error: any) {
    console.error('Error listing cards:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/cards/:id — Get card detail
router.get('/:id', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const card = db.prepare('SELECT * FROM cards WHERE id = ? AND is_deleted = 0').get(req.params.id) as any;

    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    // Attach tags
    card.tags = db.prepare(
      'SELECT t.* FROM tags t JOIN card_tags ct ON t.id = ct.tag_id WHERE ct.card_id = ?'
    ).all(card.id);

    // Parse key_takeaways
    card.key_takeaways = card.key_takeaways ? JSON.parse(card.key_takeaways) : [];

    // Attach concepts
    card.concepts = db.prepare(
      'SELECT c.* FROM concepts c JOIN card_concepts cc ON c.id = cc.concept_id WHERE cc.card_id = ?'
    ).all(card.id);

    // Attach connections with connected card info
    card.connections = db.prepare(`
      SELECT conn.*, 
        CASE WHEN conn.card_id_a = ? THEN conn.card_id_b ELSE conn.card_id_a END as connected_card_id
      FROM connections conn
      WHERE conn.card_id_a = ? OR conn.card_id_b = ?
      ORDER BY conn.strength DESC
    `).all(card.id, card.id, card.id).map((conn: any) => {
      conn.shared_concepts = conn.shared_concepts ? JSON.parse(conn.shared_concepts) : [];
      conn.connected_card = db.prepare('SELECT id, title, source_type, thumbnail_url, favicon_url FROM cards WHERE id = ?')
        .get(conn.connected_card_id);
      return conn;
    });

    // Attach notes
    card.notes = db.prepare(
      'SELECT * FROM notes WHERE card_id = ? ORDER BY position ASC'
    ).all(card.id);

    res.json(card);
  } catch (error: any) {
    console.error('Error getting card:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/cards/:id — Update card
router.patch('/:id', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);

    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const allowed = ['title', 'summary', 'is_archived', 'is_deleted'];
    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push("updated_at = datetime('now')");
    values.push(req.params.id);

    db.prepare(`UPDATE cards SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (error: any) {
    console.error('Error updating card:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/cards/:id — Soft-delete card
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    db.prepare("UPDATE cards SET is_deleted = 1, updated_at = datetime('now') WHERE id = ?")
      .run(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting card:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
