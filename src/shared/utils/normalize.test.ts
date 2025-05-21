import { describe, expect, test } from 'vitest';
import { normalize, normalizeBatch } from './normalize.util';

describe('normalize', () => {

  test('should return the normalized text', () => {
    const text = `
      Hello,  WORLD!
      áéíóú | sólidos en C#
      (.NET/Angular) co-construir C++
      • Lorem;    ::ipsum
      • Full-Stack (100%) remoto.,
      (U.S. Based) B2–C1
      🚀
    `;
    const normalizedText = normalize(text);
    expect(normalizedText).toBe('hello world aeiou solidos en c# .net angular co-construir c++ lorem ipsum full-stack 100% remoto. u.s. based b2 c1');
  });

});

describe('normalizeBatch', () => {

  test('should return the normalized batch of text', () => {
    const texts = ['Hello, World!', 'áéíóú', '.NET', '(U.S. Based)'];
    const normalizedTexts = normalizeBatch(...texts);
    expect(normalizedTexts).toEqual(['hello world', 'aeiou', '.net', 'u.s. based']);
  });

});
