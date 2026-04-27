import { describe, expect, test } from 'vitest';
import { excludeKeywords } from './exclude.keywords';

describe('excludeKeywords', () => {
  test('should include english c1 as an exclusion keyword', () => {
    expect(excludeKeywords).toContain('English C1');
  });

  test('should include ingles medio alto as an exclusion keyword', () => {
    expect(excludeKeywords).toContain('Inglés medio – alto');
  });

  test('should include ingles alto imprescindible as an exclusion keyword', () => {
    expect(excludeKeywords).toContain('Inglés alto imprescindible');
  });

  test('should include ingles fluido with colon as an exclusion keyword', () => {
    expect(excludeKeywords).toContain('Inglés: fluido');
  });

  test('should include como en ingles b2 plus as an exclusion keyword', () => {
    expect(excludeKeywords).toContain('como en inglés (B2+)');
  });

  test('should include fastapi django o flask as an exclusion keyword', () => {
    expect(excludeKeywords).toContain('FastAPI, Django o Flask');
  });

  test('should include residencia en espana as an exclusion keyword', () => {
    expect(excludeKeywords).toContain('Residencia en España');
  });
});
