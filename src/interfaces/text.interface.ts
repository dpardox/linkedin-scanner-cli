export interface Text {
  normalize(text: string): string;
  normalizeBatch(...args: string[]): string[];
}

// TODO (dpardo): add franc here
