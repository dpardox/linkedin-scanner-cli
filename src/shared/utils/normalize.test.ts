import { describe, expect, test } from 'vitest';
import { normalize, normalizeBatch } from './normalize.util';

describe('normalize', () => {

  test('should return the normalized text', () => {
    const text = `
      Hello,  WORLD!
      áéíóú | sólidos en C#
      .NET co-construir
      • Lorem; ::ipsum
      • Full-Stack (100%) remoto.,
      (U.S. Based)
      🚀
    `;
    const normalizedText = normalize(text);
    expect(normalizedText).toBe('hello world aeiou solidos en c# .net co-construir lorem ipsum full-stack 100% remoto. u.s. based');
  });

});

describe('normalizeBatch', () => {

  test('should return the normalized batch of text', () => {
    const texts = ['Hello, World!', 'áéíóú', '.NET', '(U.S. Based)'];
    const normalizedTexts = normalizeBatch(...texts);
    expect(normalizedTexts).toEqual(['hello world', 'aeiou', '.net', 'u.s. based']);
  });

});
