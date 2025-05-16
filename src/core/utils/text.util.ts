import { TextPlugin } from '@plugins/text.plugin';

const textPlugin = new TextPlugin();

export function matchWholeWord(text: string, word: string) {
  const normalizedText = textPlugin.normalize(text);
  const normalizedWord = textPlugin.normalize(word);
  const escaped = escapeRegExp(normalizedWord);

  const hasSpecial = /[^a-zA-Z0-9\s]/.test(normalizedWord);

  const pattern = hasSpecial
    ? new RegExp(`(^|[^\\w])${escaped}([^\\w]|$)`, 'i')
    : new RegExp(`\\b${escaped}\\b`, 'i');

  return pattern.test(normalizedText);
}

export function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractEmails(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return text.match(emailRegex) || [];
}


// TODO (dpardo): move to functions/ helpers/ or plugins/
// TODO (dpardo): test this function
