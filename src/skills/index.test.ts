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

  test('should build strict include and strict exclude keywords from reusable skills', () => {
    expect(createKeywords({
      includeSkills: [['Angular', 'AngularJS']],
      excludeSkills: [['English C1'], ['PHP']],
      includeKeywords: ['TypeScript'],
      excludeKeywords: ['Java'],
    })).toEqual({
      strictInclude: ['Angular', 'AngularJS', 'TypeScript'],
      strictExclude: ['English C1', 'PHP', 'Java'],
    });
  });
});
