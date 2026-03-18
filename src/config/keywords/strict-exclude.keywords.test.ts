import { describe, expect, test } from 'vitest';
import { strictExcludeKeywords } from './strict-exclude.keywords';

describe('strictExcludeKeywords', () => {
  test('should include english c1 as a strict exclusion keyword', () => {
    expect(strictExcludeKeywords).toContain('English C1');
  });

  test('should include ingles medio alto as a strict exclusion keyword', () => {
    expect(strictExcludeKeywords).toContain('Inglés medio – alto');
  });

  test('should include ingles alto imprescindible as a strict exclusion keyword', () => {
    expect(strictExcludeKeywords).toContain('Inglés alto imprescindible');
  });

  test('should include fastapi django o flask as a strict exclusion keyword', () => {
    expect(strictExcludeKeywords).toContain('FastAPI, Django o Flask');
  });

  test('should include residencia en espana as a strict exclusion keyword', () => {
    expect(strictExcludeKeywords).toContain('Residencia en España');
  });
});
