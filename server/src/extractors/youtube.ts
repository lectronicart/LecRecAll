import type { ExtractedContent } from '../../../shared/types.js';

// Dynamic import to handle ESM/CJS compat
async function getTranscript(videoId: string) {
  const mod = await import('youtube-transcript');
  const fetchFn = mod.fetchTranscript || mod.YoutubeTranscript?.fetchTranscript;
  if (!fetchFn) throw new Error('youtube-transcript module has no fetchTranscript export');
  return fetchFn(videoId);
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function getVideoMetadata(videoId: string): Promise<{
  title: string;
  author: string;
  thumbnail_url: string;
}> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const response = await fetch(oembedUrl);
    if (response.ok) {
      const data = await response.json() as any;
      return {
        title: data.title || `YouTube Video ${videoId}`,
        author: data.author_name || null,
        thumbnail_url: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      };
    }
  } catch {
    // Fallback
  }

  return {
    title: `YouTube Video ${videoId}`,
    author: 'Unknown',
    thumbnail_url: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
  };
}

export async function extractYoutube(url: string): Promise<ExtractedContent> {
  const videoId = extractVideoId(url);
  if (!videoId) {
    throw new Error('Could not extract YouTube video ID from URL');
  }

  // Get transcript
  let transcriptText = '';
  let markdown = '';

  try {
    const transcriptItems = await getTranscript(videoId);
    transcriptText = transcriptItems.map(item => item.text).join(' ');
    
    // Create timestamped markdown
    markdown = '## Transcript\n\n';
    for (const item of transcriptItems) {
      const minutes = Math.floor(item.offset / 60000);
      const seconds = Math.floor((item.offset % 60000) / 1000);
      const timestamp = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      markdown += `**[${timestamp}]** ${item.text}\n\n`;
    }
  } catch (error) {
    transcriptText = '(Transcript not available for this video)';
    markdown = '*Transcript could not be fetched. The video may not have captions enabled.*';
  }

  // Get video metadata
  const metadata = await getVideoMetadata(videoId);
  const wordCount = transcriptText.split(/\s+/).filter(Boolean).length;

  return {
    title: metadata.title,
    content: transcriptText,
    markdown,
    author: metadata.author,
    published_date: null,
    thumbnail_url: metadata.thumbnail_url,
    favicon_url: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=64',
    source_type: 'youtube',
    word_count: wordCount,
  };
}
