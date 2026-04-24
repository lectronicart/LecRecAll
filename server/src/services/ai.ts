import getDatabase from '../db/index.js';

// OpenRouter-compatible AI service
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' };
}

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key || key === 'sk-or-v1-your-key-here') {
    throw new Error('OPENROUTER_API_KEY is not configured. Please set it in your .env file.');
  }
  return key;
}

function getDefaultModel(): string {
  const db = getDatabase();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('default_model') as { value: string } | undefined;
  return row?.value || process.env.DEFAULT_MODEL || 'google/gemma-2-9b-it:free';
}

export async function chatCompletion(
  messages: ChatCompletionMessage[],
  options: ChatCompletionOptions = {}
): Promise<string> {
  const apiKey = getApiKey();
  const model = options.model || getDefaultModel();

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3001',
      'X-Title': 'LecRecAll',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 2048,
      ...(options.response_format ? { response_format: options.response_format } : {}),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content || '';
}

export async function summarize(content: string, title: string): Promise<{ summary: string; key_takeaways: string[] }> {
  const truncated = content.slice(0, 12000); // Keep within context limits

  const result = await chatCompletion([
    {
      role: 'system',
      content: `You are a knowledge summarization assistant. Given content, produce a concise yet comprehensive summary and key takeaways.
      
Respond in JSON format:
{
  "summary": "A 2-3 paragraph summary capturing the main ideas, arguments, and conclusions.",
  "key_takeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3", "...up to 7 takeaways"]
}`
    },
    {
      role: 'user',
      content: `Summarize this content titled "${title}":\n\n${truncated}`
    }
  ], { temperature: 0.3, response_format: { type: 'json_object' } });

  try {
    const parsed = JSON.parse(result);
    return {
      summary: parsed.summary || 'Summary could not be generated.',
      key_takeaways: parsed.key_takeaways || [],
    };
  } catch {
    return { summary: result, key_takeaways: [] };
  }
}

export async function extractTags(content: string, title: string, existingTags: string[]): Promise<string[]> {
  const truncated = content.slice(0, 8000);

  const result = await chatCompletion([
    {
      role: 'system',
      content: `You are a knowledge categorization assistant. Given content, suggest relevant tags for organizing it.
      
Rules:
- Suggest 2-5 tags
- Tags should be broad categories (e.g., "Technology", "Psychology", "Finance") not specific topics
- Prefer reusing existing tags when relevant
- Return lowercase tags

Existing tags in the system: ${existingTags.length > 0 ? existingTags.join(', ') : 'none yet'}

Respond in JSON format:
{ "tags": ["tag1", "tag2", "tag3"] }`
    },
    {
      role: 'user',
      content: `Suggest tags for this content titled "${title}":\n\n${truncated}`
    }
  ], { temperature: 0.2, response_format: { type: 'json_object' } });

  try {
    const parsed = JSON.parse(result);
    return parsed.tags || [];
  } catch {
    return [];
  }
}

export async function extractConcepts(content: string, title: string): Promise<Array<{ name: string; description: string }>> {
  const truncated = content.slice(0, 8000);

  const result = await chatCompletion([
    {
      role: 'system',
      content: `You are a knowledge extraction assistant. Given content, extract the key concepts, entities, and ideas mentioned.
      
Rules:
- Extract 3-8 key concepts
- Each concept should be a specific idea, person, framework, theory, or entity
- Provide a brief 1-sentence description for each

Respond in JSON format:
{ "concepts": [{ "name": "Concept Name", "description": "Brief description" }] }`
    },
    {
      role: 'user',
      content: `Extract key concepts from this content titled "${title}":\n\n${truncated}`
    }
  ], { temperature: 0.2, response_format: { type: 'json_object' } });

  try {
    const parsed = JSON.parse(result);
    return parsed.concepts || [];
  } catch {
    return [];
  }
}

export async function generateQuizQuestions(
  content: string,
  title: string,
  count: number = 5
): Promise<Array<{
  question_type: string;
  question: string;
  options: string[] | null;
  correct_answer: string;
  explanation: string;
}>> {
  const truncated = content.slice(0, 10000);

  const result = await chatCompletion([
    {
      role: 'system',
      content: `You are a quiz generation assistant. Create quiz questions to test understanding of the given content.
      
Generate ${count} questions with a mix of types:
- multiple_choice: 4 options, 1 correct
- short_answer: brief expected answer

Respond in JSON format:
{ "questions": [
  { "question_type": "multiple_choice", "question": "...", "options": ["A", "B", "C", "D"], "correct_answer": "A", "explanation": "..." },
  { "question_type": "short_answer", "question": "...", "options": null, "correct_answer": "...", "explanation": "..." }
] }`
    },
    {
      role: 'user',
      content: `Generate quiz questions about this content titled "${title}":\n\n${truncated}`
    }
  ], { temperature: 0.5, response_format: { type: 'json_object' } });

  try {
    const parsed = JSON.parse(result);
    return parsed.questions || [];
  } catch {
    return [];
  }
}

export async function fetchAvailableModels(): Promise<any[]> {
  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
      headers: {
        'Authorization': `Bearer ${getApiKey()}`,
      },
    });

    if (!response.ok) return [];

    const data = await response.json() as any;
    return data.data || [];
  } catch {
    return [];
  }
}
