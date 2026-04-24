import { useState, useEffect, useRef } from 'react';

interface ListenModeProps {
  text: string;
}

export default function ListenMode({ text }: ListenModeProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [rate, setRate] = useState(1.0);
  const [showSettings, setShowSettings] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const intervalRef = useRef<number | null>(null);
  const totalCharsRef = useRef(0);
  const spokenCharsRef = useRef(0);

  useEffect(() => {
    const loadVoices = () => {
      const v = speechSynthesis.getVoices();
      setVoices(v);
      // Prefer a natural-sounding English voice
      const preferred = v.find(voice =>
        voice.lang.startsWith('en') && (voice.name.includes('Natural') || voice.name.includes('Samantha') || voice.name.includes('Google'))
      ) || v.find(voice => voice.lang.startsWith('en'));
      if (preferred) setSelectedVoice(preferred.name);
    };
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
    return () => { speechSynthesis.cancel(); clearProgressInterval(); };
  }, []);

  const clearProgressInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const speak = () => {
    if (isPaused) {
      speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      startProgressTracking();
      return;
    }

    speechSynthesis.cancel();
    clearProgressInterval();

    // Split text into chunks (speechSynthesis has limits on long text)
    const cleanText = text.replace(/[#*_`>]/g, '').replace(/\n{3,}/g, '\n\n');
    totalCharsRef.current = cleanText.length;
    spokenCharsRef.current = 0;

    const chunks = splitTextIntoChunks(cleanText, 200);
    let currentChunk = 0;

    const speakChunk = () => {
      if (currentChunk >= chunks.length) {
        stop();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunks[currentChunk]);
      utteranceRef.current = utterance;

      const voice = voices.find(v => v.name === selectedVoice);
      if (voice) utterance.voice = voice;
      utterance.rate = rate;
      utterance.pitch = 1.0;

      utterance.onend = () => {
        spokenCharsRef.current += chunks[currentChunk].length;
        currentChunk++;
        speakChunk();
      };

      utterance.onerror = (e) => {
        if (e.error !== 'interrupted' && e.error !== 'canceled') {
          console.error('Speech error:', e.error);
        }
      };

      speechSynthesis.speak(utterance);
    };

    speakChunk();
    setIsPlaying(true);
    setIsPaused(false);
    startProgressTracking();
  };

  const startProgressTracking = () => {
    clearProgressInterval();
    intervalRef.current = window.setInterval(() => {
      if (totalCharsRef.current > 0) {
        setProgress(Math.min((spokenCharsRef.current / totalCharsRef.current) * 100, 100));
      }
    }, 200);
  };

  const pause = () => {
    speechSynthesis.pause();
    setIsPaused(true);
    setIsPlaying(false);
    clearProgressInterval();
  };

  const stop = () => {
    speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);
    spokenCharsRef.current = 0;
    clearProgressInterval();
  };

  const splitTextIntoChunks = (text: string, maxWords: number): string[] => {
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
    const chunks: string[] = [];
    let current = '';

    for (const sentence of sentences) {
      const words = (current + ' ' + sentence).trim().split(/\s+/);
      if (words.length > maxWords && current) {
        chunks.push(current.trim());
        current = sentence;
      } else {
        current = (current + ' ' + sentence).trim();
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks;
  };

  const estMinutes = Math.ceil(text.split(/\s+/).length / (150 * rate));

  return (
    <div className="listen-mode">
      <div className="listen-controls">
        <button
          className={`listen-play-btn ${isPlaying ? 'playing' : ''}`}
          onClick={isPlaying ? pause : speak}
          title={isPlaying ? 'Pause' : isPaused ? 'Resume' : 'Listen'}
        >
          {isPlaying ? '⏸' : '▶️'}
        </button>

        {(isPlaying || isPaused) && (
          <button className="btn btn-ghost btn-sm" onClick={stop} title="Stop">⏹</button>
        )}

        <div className="listen-info">
          <span className="listen-label">
            {isPlaying ? '🔊 Listening...' : isPaused ? '⏸ Paused' : '🎧 Listen Mode'}
          </span>
          <span className="listen-duration">~{estMinutes} min</span>
        </div>

        <button
          className="btn btn-ghost btn-icon btn-sm"
          onClick={() => setShowSettings(!showSettings)}
          title="Settings"
        >
          ⚙️
        </button>
      </div>

      {(isPlaying || isPaused) && (
        <div className="listen-progress-bar">
          <div className="listen-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      )}

      {showSettings && (
        <div className="listen-settings">
          <div className="listen-setting">
            <label>Voice</label>
            <select
              value={selectedVoice}
              onChange={e => setSelectedVoice(e.target.value)}
              className="form-input"
              style={{ padding: '6px 10px', fontSize: '0.8rem' }}
            >
              {voices.filter(v => v.lang.startsWith('en')).map(v => (
                <option key={v.name} value={v.name}>{v.name}</option>
              ))}
            </select>
          </div>
          <div className="listen-setting">
            <label>Speed: {rate}x</label>
            <input
              type="range" min="0.5" max="2.5" step="0.25"
              value={rate}
              onChange={e => setRate(parseFloat(e.target.value))}
            />
          </div>
        </div>
      )}
    </div>
  );
}
