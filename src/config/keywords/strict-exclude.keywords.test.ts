import { describe, expect, test } from 'vitest';
import { strictExcludeKeywords } from './strict-exclude.keywords';

describe('strictExcludeKeywords', () => {

  test('should include english c1 as a strict exclusion keyword', () => {
    expect(strictExcludeKeywords).toContain('English C1');
  });

  test('should include ingles medio alto as a strict exclusion keyword', () => {
    expect(strictExcludeKeywords).toContain('Inglés medio – alto');
  });

});
