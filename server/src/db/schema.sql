-- LecRecAll Database Schema

-- Cards: The core unit of knowledge
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT,
  source_type TEXT NOT NULL DEFAULT 'article', -- article, youtube, podcast, pdf, note, wikipedia, tiktok
  content_raw TEXT, -- original extracted text
  content_markdown TEXT, -- cleaned markdown version
  summary TEXT, -- AI-generated summary
  key_takeaways TEXT, -- JSON array of key points
  thumbnail_url TEXT,
  favicon_url TEXT,
  author TEXT,
  published_date TEXT,
  word_count INTEGER DEFAULT 0,
  is_archived INTEGER DEFAULT 0,
  is_deleted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Tags: Hierarchical organization
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#7c5cfc',
  parent_tag_id TEXT,
  usage_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (parent_tag_id) REFERENCES tags(id) ON DELETE SET NULL
);

-- Card-Tag junction
CREATE TABLE IF NOT EXISTS card_tags (
  card_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  is_ai_suggested INTEGER DEFAULT 0,
  PRIMARY KEY (card_id, tag_id),
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Concepts: Key ideas extracted from content for linking
CREATE TABLE IF NOT EXISTS concepts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  usage_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Card-Concept junction
CREATE TABLE IF NOT EXISTS card_concepts (
  card_id TEXT NOT NULL,
  concept_id TEXT NOT NULL,
  relevance_score REAL DEFAULT 1.0,
  PRIMARY KEY (card_id, concept_id),
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
  FOREIGN KEY (concept_id) REFERENCES concepts(id) ON DELETE CASCADE
);

-- Connections: Auto-generated links between related cards
CREATE TABLE IF NOT EXISTS connections (
  id TEXT PRIMARY KEY,
  card_id_a TEXT NOT NULL,
  card_id_b TEXT NOT NULL,
  strength REAL DEFAULT 0.5, -- 0 to 1
  shared_concepts TEXT, -- JSON array of shared concept names
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (card_id_a) REFERENCES cards(id) ON DELETE CASCADE,
  FOREIGN KEY (card_id_b) REFERENCES cards(id) ON DELETE CASCADE,
  UNIQUE(card_id_a, card_id_b)
);

-- Notes: User notes attached to cards
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  content TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);

-- Quizzes
CREATE TABLE IF NOT EXISTS quizzes (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  title TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);

-- Quiz Questions
CREATE TABLE IF NOT EXISTS quiz_questions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'multiple_choice', -- multiple_choice, short_answer, matching
  question TEXT NOT NULL,
  options TEXT, -- JSON array for multiple choice
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  -- Spaced repetition fields (SM-2)
  ease_factor REAL DEFAULT 2.5,
  interval_days INTEGER DEFAULT 1,
  repetitions INTEGER DEFAULT 0,
  next_review TEXT DEFAULT (datetime('now')),
  last_reviewed TEXT,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

-- Chat history
CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  card_id TEXT, -- NULL means chat with entire knowledge base
  title TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

-- Settings
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Full-text search index
CREATE VIRTUAL TABLE IF NOT EXISTS cards_fts USING fts5(
  title, content_markdown, summary, key_takeaways,
  content='cards',
  content_rowid='rowid'
);

-- Triggers to keep FTS index in sync
CREATE TRIGGER IF NOT EXISTS cards_ai AFTER INSERT ON cards BEGIN
  INSERT INTO cards_fts(rowid, title, content_markdown, summary, key_takeaways)
  VALUES (new.rowid, new.title, new.content_markdown, new.summary, new.key_takeaways);
END;

CREATE TRIGGER IF NOT EXISTS cards_ad AFTER DELETE ON cards BEGIN
  INSERT INTO cards_fts(cards_fts, rowid, title, content_markdown, summary, key_takeaways)
  VALUES ('delete', old.rowid, old.title, old.content_markdown, old.summary, old.key_takeaways);
END;

CREATE TRIGGER IF NOT EXISTS cards_au AFTER UPDATE ON cards BEGIN
  INSERT INTO cards_fts(cards_fts, rowid, title, content_markdown, summary, key_takeaways)
  VALUES ('delete', old.rowid, old.title, old.content_markdown, old.summary, old.key_takeaways);
  INSERT INTO cards_fts(rowid, title, content_markdown, summary, key_takeaways)
  VALUES (new.rowid, new.title, new.content_markdown, new.summary, new.key_takeaways);
END;

-- Default settings
INSERT OR IGNORE INTO settings (key, value) VALUES ('default_model', 'google/gemma-2-9b-it:free');
INSERT OR IGNORE INTO settings (key, value) VALUES ('theme', 'dark');
