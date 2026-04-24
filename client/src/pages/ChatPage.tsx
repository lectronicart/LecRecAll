import { useState } from 'react';
import { api } from '../services/api';

export default function ChatPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);
    try {
      const res = await api.chat.send({ session_id: sessionId || undefined, message: msg });
      setSessionId(res.session_id);
      setMessages(prev => [...prev, res.message]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header">
        <h1 className="page-title">💬 Chat with your Knowledge</h1>
        <button className="btn btn-secondary btn-sm" onClick={() => { setMessages([]); setSessionId(null); }}>New Chat</button>
      </div>
      <div className="chat-messages" style={{ flex: 1 }}>
        {messages.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🧠</div>
            <h3>Ask anything about your knowledge</h3>
            <p>Your AI assistant has context from all your saved content. Try asking questions that span multiple sources.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {['What are the key themes across my saves?', 'Summarize what I know about sleep', 'What connections can you find?'].map(q => (
                <button key={q} className="filter-chip" onClick={() => { setInput(q); }}>{q}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`chat-message ${msg.role}`}>{msg.content}</div>
        ))}
        {loading && <div className="chat-message assistant" style={{ opacity: 0.6 }}>Thinking...</div>}
      </div>
      <form className="chat-input-area" onSubmit={send}>
        <input placeholder="Ask your knowledge base..." value={input} onChange={e => setInput(e.target.value)} />
        <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>Send</button>
      </form>
    </div>
  );
}
