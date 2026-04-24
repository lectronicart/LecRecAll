import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import type { ExtractedContent } from '../../../shared/types.js';

export async function extractArticle(url: string): Promise<ExtractedContent> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;

  // Extract favicon
  const faviconLink = doc.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
  const faviconUrl = faviconLink?.getAttribute('href')
    ? new URL(faviconLink.getAttribute('href')!, url).href
    : `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`;

  // Extract OG image for thumbnail
  const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
  const thumbnailUrl = ogImage ? new URL(ogImage, url).href : null;

  // Extract author
  const authorMeta = doc.querySelector('meta[name="author"], meta[property="article:author"]');
  const author = authorMeta?.getAttribute('content') || null;

  // Extract published date
  const dateMeta = doc.querySelector('meta[property="article:published_time"], meta[name="date"]');
  const publishedDate = dateMeta?.getAttribute('content') || null;

  // Use Readability for clean content extraction
  const reader = new Readability(doc);
  const article = reader.parse();

  if (!article) {
    throw new Error('Could not extract article content from URL');
  }

  // Convert to simple markdown
  const markdown = htmlToMarkdown(article.content);
  const wordCount = markdown.split(/\s+/).filter(Boolean).length;

  return {
    title: article.title || doc.title || 'Untitled Article',
    content: article.textContent || '',
    markdown,
    author: author || article.byline || null,
    published_date: publishedDate,
    thumbnail_url: thumbnailUrl,
    favicon_url: faviconUrl,
    source_type: url.includes('wikipedia.org') ? 'wikipedia' : 'article',
    word_count: wordCount,
  };
}

function htmlToMarkdown(html: string): string {
  // Simple HTML-to-Markdown conversion
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
    .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
