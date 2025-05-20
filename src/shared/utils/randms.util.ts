export function randms(from = .5, to = 1): number {
  return (Math.random() * ((to - from) * 1000) | 0) + from * 1000;
}
