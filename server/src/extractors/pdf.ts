import type { ExtractedContent } from '../../../shared/types.js';

export async function extractPdf(buffer: Buffer, filename: string): Promise<ExtractedContent> {
  // Dynamic import for pdf-parse (CJS module)
  const pdfParse = (await import('pdf-parse')).default;
  const data = await pdfParse(buffer);

  const markdown = data.text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const wordCount = markdown.split(/\s+/).filter(Boolean).length;

  return {
    title: data.info?.Title || filename.replace(/\.pdf$/i, '') || 'Untitled PDF',
    content: data.text,
    markdown,
    author: data.info?.Author || null,
    published_date: data.info?.CreationDate || null,
    thumbnail_url: null,
    favicon_url: null,
    source_type: 'pdf',
    word_count: wordCount,
  };
}
