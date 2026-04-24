// Shared types between client and server

export type SourceType = 'article' | 'youtube' | 'podcast' | 'pdf' | 'note' | 'wikipedia' | 'tiktok' | 'other';

export interface Card {
  id: string;
  title: string;
  url: string | null;
  source_type: SourceType;
  content_raw: string | null;
  content_markdown: string | null;
  summary: string | null;
  key_takeaways: string[] | null;
  thumbnail_url: string | null;
  favicon_url: string | null;
  author: string | null;
  published_date: string | null;
  word_count: number;
  is_archived: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  tags?: Tag[];
  concepts?: Concept[];
  connections?: CardConnection[];
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  parent_tag_id: string | null;
  usage_count: number;
  created_at: string;
}

export interface Concept {
  id: string;
  name: string;
  description: string | null;
  usage_count: number;
  created_at: string;
}

export interface CardConnection {
  id: string;
  card_id_a: string;
  card_id_b: string;
  strength: number;
  shared_concepts: string[];
  created_at: string;
  connected_card?: Card;
}

export interface Note {
  id: string;
  card_id: string;
  content: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Quiz {
  id: string;
  card_id: string;
  title: string | null;
  questions?: QuizQuestion[];
  created_at: string;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_type: 'multiple_choice' | 'short_answer' | 'matching';
  question: string;
  options: string[] | null;
  correct_answer: string;
  explanation: string | null;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review: string;
  last_reviewed: string | null;
}

export interface ChatSession {
  id: string;
  card_id: string | null;
  title: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface ExtractedContent {
  title: string;
  content: string;
  markdown: string;
  author: string | null;
  published_date: string | null;
  thumbnail_url: string | null;
  favicon_url: string | null;
  source_type: SourceType;
  word_count: number;
}

export interface CreateCardRequest {
  url?: string;
  content?: string;
  title?: string;
  source_type?: SourceType;
}

export interface CardsListQuery {
  search?: string;
  tag?: string;
  source_type?: SourceType;
  sort?: 'newest' | 'oldest' | 'title' | 'most_connected';
  page?: number;
  limit?: number;
}

// OpenRouter types
export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  context_length: number;
  top_provider?: {
    max_completion_tokens: number;
  };
}
