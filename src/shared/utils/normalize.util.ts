export function normalize(text: string): string {
  text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  text = text.replace(/[/!,()]/g, ' ');
  text = text.replace(/[\s\n\r\t]+/g, ' ').trim();
  return text.toLowerCase();
}

export function normalizeBatch(...args: string[]): string[] {
  return args.map(text => normalize(text));
}
