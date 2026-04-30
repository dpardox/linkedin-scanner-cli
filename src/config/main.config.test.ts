import { describe, expect, test, vi } from 'vitest';
import { defaultScannerPreferences } from './default-scanner-preferences';
import { createScannerConfig } from './main.config';

describe('main config', () => {

  test('should normalize single-term exact job searches before building configs', () => {
    const ruleManager = {
      createKeywords: vi.fn(() => ({
        include: [],
        exclude: [],
      })),
    };
    const config = createScannerConfig({
      ...defaultScannerPreferences,
      searchQueries: ['"angular"', 'angular', '"frontend developer"'],
      locationKeys: ['colombia'],
    }, ruleManager as any);

    expect(config.jobSearchConfigs.map(({ query }) => query)).toEqual(['angular', '"frontend developer"']);
  });

  test('should build strict job search configs before loose configs', () => {
    const ruleManager = {
      createKeywords: vi.fn(() => ({
        include: [],
        exclude: [],
      })),
    };
    const config = createScannerConfig({
      ...defaultScannerPreferences,
      searchQueries: ['angular'],
      strictSearchMode: true,
      locationKeys: ['colombia'],
    }, ruleManager as any);

    expect(config.jobSearchConfigs.map(({ query }) => query)).toEqual(['"angular"', 'angular']);
  });

});
