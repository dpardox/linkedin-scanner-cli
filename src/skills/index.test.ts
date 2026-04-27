import { describe, expect, test } from 'vitest';
import { createKeywords, mergeKeywordGroups } from './index';

describe('skills helpers', () => {
  test('should merge keyword groups without duplicates', () => {
    expect(mergeKeywordGroups(['Angular', 'TypeScript'], ['Angular'], ['RxJS'])).toEqual([
      'Angular',
      'TypeScript',
      'RxJS',
    ]);
  });

  test('should build include and exclude keywords from reusable skills', () => {
    expect(createKeywords({
      includeSkills: [['Angular', 'AngularJS']],
      excludeSkills: [['English C1'], ['PHP']],
      includeKeywords: ['TypeScript'],
      excludeKeywords: ['Java'],
    })).toEqual({
      include: ['Angular', 'AngularJS', 'TypeScript'],
      exclude: ['English C1', 'PHP', 'Java'],
    });
  });
});
