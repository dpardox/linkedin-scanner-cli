import { normalize } from './normalize.util';

export function matchWholeWord(text: string, word: string): boolean {
  const normalizedText = normalize(text);
  const normalizedWord = normalize(word);
  const escaped = escapeRegExp(normalizedWord);

  const hasSpecial = /[^a-zA-Z0-9\s]/.test(normalizedWord);

  const pattern = hasSpecial
    ? new RegExp(`(^|[^\\w])${escaped}([^\\w]|$)`, 'i')
    : new RegExp(`\\b${escaped}\\b`, 'i');

  return pattern.test(normalizedText);
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


// TODO (dpardo): test this function
