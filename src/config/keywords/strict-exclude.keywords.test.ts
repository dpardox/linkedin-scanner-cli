import { describe, expect, test } from 'vitest';
import { strictExcludeKeywords } from './strict-exclude.keywords';

describe('strictExcludeKeywords', () => {

  test('should include english c1 as a strict exclusion keyword', () => {
    expect(strictExcludeKeywords).toContain('English C1');
  });

});
