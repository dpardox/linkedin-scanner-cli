import { describe, expect, test } from 'vitest';
import { createJobSearchQueries, normalizeJobSearchQueries, normalizeJobSearchQuery } from './job-search-query.util';

describe('job search query helpers', () => {

  test('should remove exact-search quotes from single-term job searches', () => {
    expect(normalizeJobSearchQuery('"angular"')).toBe('angular');
  });

  test('should keep exact-search quotes in phrase job searches', () => {
    expect(normalizeJobSearchQuery('"frontend developer"')).toBe('"frontend developer"');
  });

  test('should trim and dedupe normalized job searches', () => {
    expect(normalizeJobSearchQueries(['"angular"', 'angular', '  react  '])).toEqual(['angular', 'react']);
  });

  test('should expand strict job searches before loose searches', () => {
    expect(createJobSearchQueries(['angular', 'react'], true)).toEqual([
      '"angular"',
      '"react"',
      'angular',
      'react',
    ]);
  });

  test('should keep loose job searches when strict mode is disabled', () => {
    expect(createJobSearchQueries(['angular'], false)).toEqual(['angular']);
  });

  test('should dedupe expanded strict job searches', () => {
    expect(createJobSearchQueries(['"frontend developer"', 'frontend developer'], true)).toEqual([
      '"frontend developer"',
      'frontend developer',
    ]);
  });

});
