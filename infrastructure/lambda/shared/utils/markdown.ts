/**
 * Markdown Processing Utilities
 *
 * Convert Markdown to plain text for TTS and other purposes
 */

/**
 * Convert Markdown text to plain text by stripping Markdown syntax
 *
 * This function removes Markdown formatting while preserving the actual content
 * for use in Text-to-Speech systems.
 */
export function markdownToPlainText(markdown: string): string {
  if (!markdown) return '';

  let text = markdown;

  // Remove code blocks (```code```)
  text = text.replace(/```[\s\S]*?```/g, '');

  // Remove inline code (`code`)
  text = text.replace(/`([^`]+)`/g, '$1');

  // Remove headers (# Header)
  text = text.replace(/^#+\s+(.+)$/gm, '$1');

  // Remove bold (**text** or __text__)
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');

  // Remove italic (*text* or _text_)
  text = text.replace(/(\*|_)(.*?)\1/g, '$2');

  // Remove strikethrough (~~text~~)
  text = text.replace(/~~(.*?)~~/g, '$1');

  // Remove links [text](url) -> text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Remove images ![alt](url) -> alt
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');

  // Remove blockquotes (> text)
  text = text.replace(/^>\s+(.+)$/gm, '$1');

  // Remove horizontal rules (---, ___, ***)
  text = text.replace(/^([-_*]){3,}$/gm, '');

  // Remove list markers (-, *, +, 1.)
  text = text.replace(/^[\s]*[-*+]\s+/gm, '');
  text = text.replace(/^[\s]*\d+\.\s+/gm, '');

  // Remove HTML tags
  text = text.replace(/<[^>]*>/g, '');

  // Clean up excessive whitespace
  text = text.replace(/\n{3,}/g, '\n\n'); // Max 2 newlines
  text = text.replace(/[ \t]{2,}/g, ' '); // Max 1 space
  text = text.trim();

  return text;
}

/**
 * Escape Markdown special characters for safe storage
 */
export function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+\-.!])/g, '\\$1');
}

/**
 * Check if text contains Markdown syntax
 */
export function isMarkdown(text: string): boolean {
  const markdownPatterns = [
    /^#+\s/m, // Headers
    /\*\*.*?\*\*/, // Bold
    /_.*?_/, // Italic
    /\[.*?\]\(.*?\)/, // Links
    /```[\s\S]*?```/, // Code blocks
    /`.*?`/, // Inline code
    /^>\s/m, // Blockquotes
    /^[-*+]\s/m, // Lists
  ];

  return markdownPatterns.some(pattern => pattern.test(text));
}

/**
 * Extract plain text summary from Markdown (first paragraph only)
 */
export function extractSummary(markdown: string, maxLength: number = 100): string {
  const plainText = markdownToPlainText(markdown);
  const firstParagraph = plainText.split('\n\n')[0];

  if (firstParagraph.length <= maxLength) {
    return firstParagraph;
  }

  return firstParagraph.substring(0, maxLength - 3) + '...';
}
