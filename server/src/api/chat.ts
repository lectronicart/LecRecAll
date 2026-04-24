import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import getDatabase from '../db/index.js';
import { chatCompletion, fetchAvailableModels } from '../services/ai.js';

const router = Router();

// POST /api/chat — Send a message
router.post('/', async (req: Request, res: Response) => {
  try {
    const { session_id, message, card_id, model } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const db = getDatabase();
    let sessionId = session_id;

    // Create session if needed
    if (!sessionId) {
      sessionId = uuidv4();
      db.prepare('INSERT INTO chat_sessions (id, card_id, title) VALUES (?, ?, ?)')
        .run(sessionId, card_id || null, message.slice(0, 100));
    }

    // Save user message
    db.prepare('INSERT INTO chat_messages (id, session_id, role, content) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), sessionId, 'user', message);

    // Build context
    let context = '';
    if (card_id) {
      // Chat with a specific card
      const card = db.prepare('SELECT title, content_markdown, summary, key_takeaways FROM cards WHERE id = ?').get(card_id) as any;
      if (card) {
        context = `You are answering questions about a piece of content the user saved.\n\nTitle: ${card.title}\n\nSummary: ${card.summary || 'N/A'}\n\nFull content:\n${(card.content_markdown || '').slice(0, 10000)}`;
      }
    } else {
      // Chat with entire knowledge base
      const cards = db.prepare(`
        SELECT title, summary, source_type, url FROM cards 
        WHERE is_deleted = 0 AND summary IS NOT NULL 
        ORDER BY created_at DESC LIMIT 30
      `).all() as any[];

      context = `You are an AI assistant with access to the user's personal knowledge base. Here are summaries of their saved content:\n\n`;
      for (const card of cards) {
        context += `--- ${card.title} (${card.source_type}) ---\n${card.summary}\n\n`;
      }
      context += `Use this knowledge to answer the user's questions. Reference specific saved content when relevant. If the answer isn't in their knowledge base, say so and provide general knowledge.`;
    }

    // Get conversation history
    const history = db.prepare(
      'SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC'
    ).all(sessionId) as any[];

    const messages = [
      { role: 'system' as const, content: context },
      ...history.map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];

    // Get AI response
    const response = await chatCompletion(messages, { model });

    // Save assistant message
    db.prepare('INSERT INTO chat_messages (id, session_id, role, content) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), sessionId, 'assistant', response);

    res.json({
      session_id: sessionId,
      message: { role: 'assistant', content: response },
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/chat/sessions — List chat sessions
router.get('/sessions', (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const sessions = db.prepare(`
      SELECT cs.*, c.title as card_title
      FROM chat_sessions cs
      LEFT JOIN cards c ON cs.card_id = c.id
      ORDER BY cs.created_at DESC
    `).all();
    res.json(sessions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/chat/sessions/:id/messages — Get session messages
router.get('/sessions/:id/messages', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const messages = db.prepare(
      'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC'
    ).all(req.params.id);
    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/chat/models — List available OpenRouter models
router.get('/models', async (_req: Request, res: Response) => {
  try {
    const models = await fetchAvailableModels();
    res.json(models);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Settings endpoints
// GET /api/settings — Get all settings
router.get('/settings', (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const settings = db.prepare('SELECT * FROM settings').all();
    const result: Record<string, string> = {};
    for (const s of settings as any[]) {
      result[s.key] = s.value;
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/settings — Update settings
router.patch('/settings', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    for (const [key, value] of Object.entries(req.body)) {
      db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\'))')
        .run(key, String(value));
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
