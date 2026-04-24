import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

interface GraphNode { id: string; title: string; source_type: string; connection_count: number; x?: number; y?: number; vx?: number; vy?: number; }
interface GraphEdge { card_id_a: string; card_id_b: string; strength: number; shared_concepts: string[]; }

export default function GraphView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const animRef = useRef<number>(0);

  useEffect(() => {
    api.graph().then((data: any) => {
      const n = (data.nodes || []).map((node: any, i: number) => ({
        ...node,
        x: 400 + Math.cos(i * 2.4) * (150 + Math.random() * 100),
        y: 300 + Math.sin(i * 2.4) * (150 + Math.random() * 100),
        vx: 0, vy: 0,
      }));
      setNodes(n);
      setEdges(data.edges || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const sourceColors: Record<string, string> = {
    article: '#7c5cfc', youtube: '#ff4444', podcast: '#44bb77',
    pdf: '#ff8844', note: '#44aaff', wikipedia: '#888888', tiktok: '#ff66aa',
  };

  // Simple force simulation
  const simulate = useCallback(() => {
    if (nodes.length === 0) return;
    const updated = [...nodes];
    for (let i = 0; i < updated.length; i++) {
      for (let j = i + 1; j < updated.length; j++) {
        const dx = updated[j].x! - updated[i].x!;
        const dy = updated[j].y! - updated[i].y!;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = 800 / (dist * dist);
        updated[i].vx! -= (dx / dist) * force;
        updated[i].vy! -= (dy / dist) * force;
        updated[j].vx! += (dx / dist) * force;
        updated[j].vy! += (dy / dist) * force;
      }
    }
    for (const edge of edges) {
      const a = updated.find(n => n.id === edge.card_id_a);
      const b = updated.find(n => n.id === edge.card_id_b);
      if (!a || !b) continue;
      const dx = b.x! - a.x!;
      const dy = b.y! - a.y!;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - 120) * 0.005 * edge.strength;
      a.vx! += (dx / dist) * force;
      a.vy! += (dy / dist) * force;
      b.vx! -= (dx / dist) * force;
      b.vy! -= (dy / dist) * force;
    }
    // Center gravity
    for (const n of updated) {
      n.vx! += (400 - n.x!) * 0.001;
      n.vy! += (300 - n.y!) * 0.001;
      n.vx! *= 0.9; n.vy! *= 0.9;
      n.x! += n.vx!; n.y! += n.vy!;
    }
    setNodes(updated);
  }, [nodes, edges]);

  useEffect(() => {
    if (nodes.length === 0) return;
    const draw = () => {
      simulate();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d')!;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw edges
      for (const edge of edges) {
        const a = nodes.find(n => n.id === edge.card_id_a);
        const b = nodes.find(n => n.id === edge.card_id_b);
        if (!a || !b) continue;
        ctx.beginPath();
        ctx.moveTo(a.x!, a.y!);
        ctx.lineTo(b.x!, b.y!);
        ctx.strokeStyle = `rgba(124, 92, 252, ${edge.strength * 0.4})`;
        ctx.lineWidth = edge.strength * 3;
        ctx.stroke();
      }

      // Draw nodes
      for (const node of nodes) {
        const r = 8 + (node.connection_count || 0) * 2;
        const color = sourceColors[node.source_type] || '#7c5cfc';
        // Glow
        ctx.beginPath();
        ctx.arc(node.x!, node.y!, r + 6, 0, Math.PI * 2);
        ctx.fillStyle = color + '22';
        ctx.fill();
        // Node
        ctx.beginPath();
        ctx.arc(node.x!, node.y!, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        // Label
        ctx.fillStyle = '#e8e8e8';
        ctx.font = '11px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(node.title.slice(0, 25), node.x!, node.y! + r + 14);
      }

      animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [nodes.length, edges.length]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    for (const node of nodes) {
      const dx = node.x! - x;
      const dy = node.y! - y;
      if (Math.sqrt(dx * dx + dy * dy) < 16) {
        navigate(`/card/${node.id}`);
        return;
      }
    }
  };

  if (loading) return <div className="loading-state"><div className="loading-spinner" /></div>;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <h1 className="page-title">🕸️ Knowledge Graph</h1>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{nodes.length} nodes · {edges.length} connections</span>
      </div>
      {nodes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🕸️</div>
          <h3>No connections yet</h3>
          <p>Save more content and the AI will automatically find connections between your knowledge.</p>
        </div>
      ) : (
        <canvas ref={canvasRef} style={{ flex: 1, cursor: 'pointer' }} onClick={handleCanvasClick} />
      )}
    </div>
  );
}
