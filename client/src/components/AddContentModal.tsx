import { useState } from 'react';
import { api } from '../services/api';

export default function AddContentModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mode, setMode] = useState<'url' | 'note'>('url');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'url') {
        if (!url.trim()) { setError('Please enter a URL'); setLoading(false); return; }
        await api.cards.create({ url: url.trim() });
      } else {
        if (!content.trim()) { setError('Please enter content'); setLoading(false); return; }
        await api.cards.create({ content: content.trim(), title: title.trim() || undefined });
      }
      onAdded();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add content');
    }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2 className="modal-title">Add Content</h2>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button className={`filter-chip ${mode === 'url' ? 'active' : ''}`} onClick={() => setMode('url')}>🔗 From URL</button>
          <button className={`filter-chip ${mode === 'note' ? 'active' : ''}`} onClick={() => setMode('note')}>📝 Note</button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'url' ? (
            <div className="form-group">
              <label className="form-label">URL</label>
              <input className="form-input" type="url" placeholder="https://example.com/article or YouTube link..." value={url} onChange={(e) => setUrl(e.target.value)} autoFocus />
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 6 }}>
                Supports articles, YouTube videos, Wikipedia, PDFs, and more
              </p>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input className="form-input" placeholder="Note title..." value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Content</label>
                <textarea className="form-textarea" placeholder="Write your note..." value={content} onChange={(e) => setContent(e.target.value)} rows={5} />
              </div>
            </>
          )}

          {error && <p style={{ color: 'var(--error)', fontSize: '0.85rem', marginBottom: 12 }}>{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '⏳ Processing...' : '✨ Save & Summarize'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
