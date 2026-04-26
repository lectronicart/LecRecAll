const API_BASE = '/api';

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers as any },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  if (res.status === 204) return null;
  return res.json();
}

// Cards
export const api = {
  cards: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request(`/cards${qs}`);
    },
    get: (id: string) => request(`/cards/${id}`),
    create: (data: { url?: string; content?: string; title?: string }) =>
      request('/cards', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request(`/cards/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request(`/cards/${id}`, { method: 'DELETE' }),
  },
  tags: {
    list: () => request('/tags'),
    create: (data: { name: string; color?: string }) =>
      request('/tags', { method: 'POST', body: JSON.stringify(data) }),
  },
  chat: {
    send: (data: { session_id?: string; message: string; card_id?: string; model?: string }) =>
      request('/chat', { method: 'POST', body: JSON.stringify(data) }),
    sessions: () => request('/chat/sessions'),
    messages: (sessionId: string) => request(`/chat/sessions/${sessionId}/messages`),
    models: () => request('/chat/models'),
  },
  quizzes: {
    list: (cardId: string) => request(`/cards/${cardId}/quizzes`),
    generate: (cardId: string) => request(`/cards/${cardId}/quiz`, { method: 'POST' }),
  },
  notes: {
    create: (cardId: string, content: string) =>
      request(`/cards/${cardId}/notes`, { method: 'POST', body: JSON.stringify({ content }) }),
    delete: (cardId: string, noteId: string) =>
      request(`/cards/${cardId}/notes/${noteId}`, { method: 'DELETE' }),
  },
  graph: () => request('/graph'),
  settings: {
    get: () => request('/chat/settings'),
    update: (data: Record<string, string>) =>
      request('/chat/settings', { method: 'PATCH', body: JSON.stringify(data) }),
  },
};
