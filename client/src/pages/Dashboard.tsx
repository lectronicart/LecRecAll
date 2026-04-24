import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';

const sourceIcons: Record<string, string> = {
  article: '📄', youtube: '▶️', podcast: '🎙️', pdf: '📑',
  note: '📝', wikipedia: '🌐', tiktok: '🎵', other: '📎',
};

interface DashboardProps {
  onAddContent?: () => void;
}

export default function Dashboard({ onAddContent }: DashboardProps) {
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const tag = searchParams.get('tag') || '';
  const sourceType = searchParams.get('source_type') || '';

  const loadCards = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (tag) params.tag = tag;
      if (sourceType) params.source_type = sourceType;
      const data = await api.cards.list(params);
      setCards(data.cards || []);
    } catch (err) {
      console.error('Failed to load cards:', err);
    }
    setLoading(false);
  };

  useEffect(() => { loadCards(); }, [tag, sourceType]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadCards();
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isMainView = !search && !tag && !sourceType;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top Toolbar matching Recall */}
      <div className="page-header" style={{ padding: '12px 24px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-icon btn-ghost" disabled>◀</button>
          <button className="btn btn-icon btn-ghost" disabled>▶</button>
        </div>

        <form onSubmit={handleSearch} className="search-bar" style={{ margin: '0 auto' }}>
          <span className="search-icon">🔍</span>
          <input placeholder="Search your knowledge base..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '300px' }} />
        </form>

        <div className="header-actions">
          <button className="btn btn-ghost btn-sm" disabled>Updated ↓</button>
          <button className="btn btn-ghost btn-sm" disabled>Grid ⊞</button>
          {onAddContent && (
            <button className="btn btn-primary" onClick={onAddContent}>
              + Add <span style={{ opacity: 0.7, fontSize: '0.75rem', marginLeft: '4px', border: '1px solid currentColor', borderRadius: '4px', padding: '0 4px' }}>⌘K</span>
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '24px 32px', flex: 1, overflowY: 'auto' }}>
        <h1 className="page-title" style={{ marginBottom: '24px' }}>
          {tag ? `#${tag}` : sourceType ? `${sourceIcons[sourceType] || ''} ${sourceType}` : 'Library'}
        </h1>

        <div className="card-grid" style={{ padding: 0 }}>
          {/* Quick Action Card (First cell) */}
          {isMainView && !loading && (
            <div className="quick-action-card">
              <button className="quick-action-btn" onClick={onAddContent}>
                <span className="quick-action-icon">🔗</span>
                Add Link
              </button>
              <button className="quick-action-btn" onClick={onAddContent}>
                <span className="quick-action-icon">📝</span>
                Write Note
              </button>
              <button className="quick-action-btn" onClick={onAddContent}>
                <span className="quick-action-icon">🌐</span>
                Wikipedia
              </button>
              <button className="quick-action-btn" onClick={onAddContent}>
                <span className="quick-action-icon">📑</span>
                PDF
              </button>
            </div>
          )}

          {loading ? (
            [1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="knowledge-card">
                <div className="skeleton" style={{ height: 160 }} />
                <div className="card-body">
                  <div className="skeleton" style={{ height: 18, width: '80%', marginBottom: 8 }} />
                  <div className="skeleton" style={{ height: 14, width: '100%', marginBottom: 4 }} />
                  <div className="skeleton" style={{ height: 14, width: '60%' }} />
                </div>
              </div>
            ))
          ) : cards.length === 0 && !isMainView ? (
             <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
              <div className="empty-icon">🧠</div>
              <h3>No results found</h3>
            </div>
          ) : (
            <>
              {cards.map((card: any) => (
                <div key={card.id} className="knowledge-card" onClick={() => navigate(`/card/${card.id}`)}>
                  <div
                    className="card-thumbnail"
                    style={{
                      backgroundImage: card.thumbnail_url ? `url(${card.thumbnail_url})` : undefined,
                      background: card.thumbnail_url ? undefined : `linear-gradient(135deg, var(--bg-elevated), var(--bg-hover))`,
                    }}
                  >
                    <div className="source-badge">
                      {sourceIcons[card.source_type] || '📎'} {card.source_type}
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="card-title">{card.title}</div>
                    {card.summary && <div className="card-summary">{card.summary}</div>}
                    <div className="card-tags" style={{ marginBottom: 12 }}>
                      {(card.tags || []).slice(0, 3).map((t: any) => (
                        <span key={t.id} className="tag-pill">{t.name}</span>
                      ))}
                    </div>
                    <div className="card-meta">
                      <span>{formatDate(card.created_at)}</span>
                      <span>{card.word_count ? `${Math.ceil(card.word_count / 200)} min read` : ''}</span>
                      {!card.summary && <span className="status-badge processing">⏳ Processing</span>}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Empty placeholder grids to match the screenshot look */}
              {Array.from({ length: Math.max(0, 10 - cards.length - (isMainView ? 1 : 0)) }).map((_, i) => (
                <div key={`empty-${i}`} style={{
                  border: '1px dashed var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  height: '240px',
                  opacity: 0.3
                }} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
