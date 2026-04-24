import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import ListenMode from '../components/ListenMode';

const sourceIcons: Record<string, string> = {
  article: '📄', youtube: '▶️', podcast: '🎙️', pdf: '📑',
  note: '📝', wikipedia: '🌐', tiktok: '🎵', other: '📎',
};

export default function CardDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [card, setCard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'summary' | 'content' | 'chat'>('summary');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.cards.get(id).then(setCard).catch(() => navigate('/')).finally(() => setLoading(false));
  }, [id]);

  const sendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: msg }]);
    setChatLoading(true);
    try {
      const res = await api.chat.send({ session_id: sessionId || undefined, message: msg, card_id: id });
      setSessionId(res.session_id);
      setChatMessages(prev => [...prev, res.message]);
    } catch (err: any) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    }
    setChatLoading(false);
  };

  if (loading) return <div className="loading-state"><div className="loading-spinner" /></div>;
  if (!card) return null;

  return (
    <div className="card-detail">
      <div className="card-detail-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Back</button>
        </div>
        <h1>{card.title}</h1>
        <div className="card-detail-meta">
          <span>{sourceIcons[card.source_type]} {card.source_type}</span>
          {card.author && <span>by {card.author}</span>}
          <span>{new Date(card.created_at).toLocaleDateString()}</span>
          {card.word_count > 0 && <span>{card.word_count.toLocaleString()} words</span>}
          {card.url && <a href={card.url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.85rem' }}>Open original ↗</a>}
        </div>
        <div className="card-tags" style={{ marginTop: 10 }}>
          {(card.tags || []).map((t: any) => <span key={t.id} className="tag-pill">{t.name}</span>)}
        </div>
      </div>

      <div className="tab-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex' }}>
          <button className={activeTab === 'summary' ? 'active' : ''} onClick={() => setActiveTab('summary')}>Notebook</button>
          <button className={activeTab === 'chat' ? 'active' : ''} onClick={() => setActiveTab('chat')}>Chat</button>
          <button className={activeTab === 'content' ? 'active' : ''} onClick={() => setActiveTab('content')}>Reader</button>
          <button disabled style={{ opacity: 0.5 }}>Quiz</button>
          <button disabled style={{ opacity: 0.5 }}>Connections</button>
          <button disabled style={{ opacity: 0.5 }}>Graph</button>
        </div>
        <div>
          <button className="btn btn-ghost btn-sm" disabled style={{ padding: '4px 10px', fontSize: '0.75rem', border: '1px solid var(--border)' }}>
            Split ◫
          </button>
        </div>
      </div>

      <div className="card-detail-body">
        <div className="card-detail-content">
          {activeTab === 'summary' && (
            <>
              {/* Listen Mode: TTS player for summary + content */}
              {card.summary && (
                <ListenMode
                  text={card.summary + (card.key_takeaways?.length ? '\n\nKey Takeaways:\n' + card.key_takeaways.join('\n') : '')}
                />
              )}

              {card.summary ? (
                <div className="summary-section">
                  <h2>Summary</h2>
                  <p className="summary-text">{card.summary}</p>
                </div>
              ) : (
                <div className="summary-section">
                  <div className="status-badge processing" style={{ marginBottom: 12 }}>⏳ AI is processing this content...</div>
                  <p className="summary-text" style={{ color: 'var(--text-muted)' }}>Summary will appear here once processing completes. Refresh to check.</p>
                </div>
              )}

              {card.key_takeaways && card.key_takeaways.length > 0 && (
                <div className="summary-section">
                  <h2>Key Takeaways</h2>
                  <ul className="takeaway-list">
                    {card.key_takeaways.map((t: string, i: number) => <li key={i}>{t}</li>)}
                  </ul>
                </div>
              )}

              {card.concepts && card.concepts.length > 0 && (
                <div className="summary-section">
                  <h2>Key Concepts</h2>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {card.concepts.map((c: any) => (
                      <div key={c.id} className="tag-pill" title={c.description} style={{ background: 'var(--bg-elevated)', color: 'var(--accent-cyan)', borderColor: 'var(--accent-cyan)' }}>
                        {c.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'content' && (
            <div className="markdown-content">
              {(card.content_markdown || card.content_raw || 'No content available').split('\n').map((line: string, i: number) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="chat-panel" style={{ height: 'calc(100vh - 280px)' }}>
              <div className="chat-messages">
                {chatMessages.length === 0 && (
                  <div className="empty-state" style={{ padding: '40px 20px' }}>
                    <div className="empty-icon">💬</div>
                    <h3>Chat with this content</h3>
                    <p>Ask questions about "{card.title}" and get AI-powered answers grounded in the content.</p>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`chat-message ${msg.role}`}>{msg.content}</div>
                ))}
                {chatLoading && <div className="chat-message assistant" style={{ opacity: 0.6 }}>Thinking...</div>}
              </div>
              <form className="chat-input-area" onSubmit={sendChat}>
                <input placeholder={`Ask about "${card.title}"...`} value={chatInput} onChange={e => setChatInput(e.target.value)} />
                <button type="submit" className="btn btn-primary btn-sm" disabled={chatLoading}>Send</button>
              </form>
            </div>
          )}
        </div>

        {/* Right sidebar: connections */}
        <div className="card-detail-sidebar">
          <div className="connections-section">
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 16 }}>🔗 Connections</h3>
            {card.connections && card.connections.length > 0 ? (
              card.connections.map((conn: any) => (
                <div key={conn.id} className="connection-card" onClick={() => navigate(`/card/${conn.connected_card?.id}`)}>
                  <div className="connection-strength" style={{ opacity: conn.strength }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {conn.connected_card?.title || 'Unknown'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {(conn.shared_concepts || []).slice(0, 3).join(', ')}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No connections yet. Add more content to build your knowledge graph.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
