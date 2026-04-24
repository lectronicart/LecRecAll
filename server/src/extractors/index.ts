import { extractArticle } from './article.js';
import { extractYoutube } from './youtube.js';
import { extractPdf } from './pdf.js';
import type { ExtractedContent, SourceType } from '../../../shared/types.js';

function detectSourceType(url: string): SourceType {
  const hostname = new URL(url).hostname.toLowerCase();

  if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'youtube';
  if (hostname.includes('wikipedia.org')) return 'wikipedia';
  if (hostname.includes('tiktok.com')) return 'tiktok';
  if (url.endsWith('.pdf')) return 'pdf';
  if (hostname.includes('spotify.com') || hostname.includes('podcasts.apple.com') || hostname.includes('podcasts.google.com')) return 'podcast';
  return 'article';
}

export async function extractFromUrl(url: string): Promise<ExtractedContent> {
  const sourceType = detectSourceType(url);

  switch (sourceType) {
    case 'youtube':
      return extractYoutube(url);
    case 'pdf':
      // For URL-based PDFs, download and extract
      const response = await fetch(url);
      const buffer = Buffer.from(await response.arrayBuffer());
      return extractPdf(buffer, new URL(url).pathname.split('/').pop() || 'document.pdf');
    case 'wikipedia':
    case 'article':
    case 'podcast':
    case 'tiktok':
    default:
      // Use generic article extractor for all web pages
      const result = await extractArticle(url);
      result.source_type = sourceType;
      return result;
  }
}

export function createNoteContent(title: string, content: string): ExtractedContent {
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  return {
    title,
    content,
    markdown: content,
    author: null,
    published_date: null,
    thumbnail_url: null,
    favicon_url: null,
    source_type: 'note',
    word_count: wordCount,
  };
}

export { extractArticle } from './article.js';
export { extractYoutube } from './youtube.js';
export { extractPdf } from './pdf.js';
