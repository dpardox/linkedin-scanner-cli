export function normalize(text: string): string {
  text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  text = text.replace(/@s/g, 'os');
  text = text.replace(/\/a/g, ' ');
  text = text.replace(/[^\p{L}\p{N}\s.#%+]/gu, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  return text.toLowerCase();
}

export function normalizeBatch(...args: string[]): string[] {
  return args.map(text => normalize(text));
}
