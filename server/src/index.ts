import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import getDatabase from './db/index.js';
import cardsRouter from './api/cards.js';
import tagsRouter from './api/tags.js';
import chatRouter from './api/chat.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize database
getDatabase();

// API Routes
app.use('/api/cards', cardsRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/chat', chatRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Graph data endpoint
app.get('/api/graph', (_req, res) => {
  try {
    const db = getDatabase();
    const nodes = db.prepare(`
      SELECT c.id, c.title, c.source_type, c.thumbnail_url, c.favicon_url,
        (SELECT COUNT(*) FROM connections WHERE card_id_a = c.id OR card_id_b = c.id) as connection_count
      FROM cards c WHERE c.is_deleted = 0
    `).all();

    const edges = db.prepare(`
      SELECT * FROM connections
    `).all().map((e: any) => ({
      ...e,
      shared_concepts: e.shared_concepts ? JSON.parse(e.shared_concepts) : [],
    }));

    res.json({ nodes, edges });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Serve frontend in production
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════╗
  ║          ⚡ LecRecAll Server            ║
  ║                                        ║
  ║  API:  http://localhost:${PORT}           ║
  ║                                        ║
  ╚════════════════════════════════════════╝
  `);
});
