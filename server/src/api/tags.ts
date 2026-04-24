import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import getDatabase from '../db/index.js';

const router = Router();

// GET /api/tags — List all tags with hierarchy
router.get('/', (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const tags = db.prepare(`
      SELECT t.*, COUNT(ct.card_id) as card_count
      FROM tags t
      LEFT JOIN card_tags ct ON t.id = ct.tag_id
      GROUP BY t.id
      ORDER BY t.usage_count DESC
    `).all();
    res.json(tags);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/tags — Create tag
router.post('/', (req: Request, res: Response) => {
  try {
    const { name, color, parent_tag_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const db = getDatabase();
    const id = uuidv4();
    const normalized = name.toLowerCase().trim();

    const existing = db.prepare('SELECT id FROM tags WHERE name = ?').get(normalized);
    if (existing) return res.status(409).json({ error: 'Tag already exists' });

    db.prepare('INSERT INTO tags (id, name, color, parent_tag_id) VALUES (?, ?, ?, ?)')
      .run(id, normalized, color || '#7c5cfc', parent_tag_id || null);

    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
    res.status(201).json(tag);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/tags/:id — Update tag
router.patch('/:id', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { name, color, parent_tag_id } = req.body;
    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name.toLowerCase().trim()); }
    if (color !== undefined) { updates.push('color = ?'); values.push(color); }
    if (parent_tag_id !== undefined) { updates.push('parent_tag_id = ?'); values.push(parent_tag_id); }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    values.push(req.params.id);
    db.prepare(`UPDATE tags SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id);
    res.json(tag);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/tags/:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
