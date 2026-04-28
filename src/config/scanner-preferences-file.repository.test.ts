import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { ScannerPreferencesFileRepository } from './scanner-preferences-file.repository';
import { defaultScannerPreferences } from './default-scanner-preferences';

const temporaryDirectories: string[] = [];

function createTemporaryPreferencesDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'scanner-preferences-'));
  temporaryDirectories.push(directory);
  return directory;
}

function readJsonLines<T>(filePath: string): T[] {
  const content = fs.readFileSync(filePath, 'utf-8').trim();
  if (!content) return [];

  return content
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}

describe('ScannerPreferencesFileRepository', () => {

  afterEach(() => {
    temporaryDirectories.splice(0).forEach((directory) => {
      fs.rmSync(directory, { recursive: true, force: true });
    });
  });

  test('should return default preferences when the file does not exist', () => {
    const repository = new ScannerPreferencesFileRepository({
      directoryPath: createTemporaryPreferencesDirectory(),
    });

    expect(repository.hasPreferences()).toBe(false);
    expect(repository.read()).toEqual(defaultScannerPreferences);
  });

  test('should persist scanner preferences', () => {
    const directoryPath = createTemporaryPreferencesDirectory();
    const repository = new ScannerPreferencesFileRepository({
      directoryPath,
    });
    const preferences = {
      ...defaultScannerPreferences,
      searchQueries: ['react'],
      languages: ['eng'],
      includeRuleIds: ['react'],
      excludeRuleIds: ['english'],
      includeKeywords: ['frontend'],
      excludeKeywords: ['backend'],
      showUnknownJobs: true,
    };

    repository.write(preferences);

    expect(repository.hasPreferences()).toBe(true);
    expect(repository.read()).toEqual(preferences);
    expect(readJsonLines(path.join(directoryPath, 'search-queries.jsonl'))).toEqual([{ query: 'react' }]);
    expect(readJsonLines(path.join(directoryPath, 'languages.jsonl'))).toEqual([{ code: 'eng' }]);
    expect(readJsonLines(path.join(directoryPath, 'rule-selections.jsonl'))).toEqual([
      { scope: 'include', ruleId: 'react' },
      { scope: 'exclude', ruleId: 'english' },
    ]);
    expect(readJsonLines(path.join(directoryPath, 'additional-keywords.jsonl'))).toEqual([
      { scope: 'include', keyword: 'frontend' },
      { scope: 'exclude', keyword: 'backend' },
    ]);
    expect(JSON.parse(fs.readFileSync(path.join(directoryPath, 'execution-options.json'), 'utf-8'))).toEqual({
      showUnknownJobs: true,
    });
  });

  test('should read legacy preferences when database preferences do not exist', () => {
    const directoryPath = createTemporaryPreferencesDirectory();
    const legacyFilePath = path.join(directoryPath, 'preferences.json');
    const repository = new ScannerPreferencesFileRepository({
      directoryPath: path.join(directoryPath, 'db'),
      legacyFilePath,
    });
    const preferences = {
      ...defaultScannerPreferences,
      searchQueries: ['angular legacy'],
      showUnknownJobs: true,
    };

    fs.writeFileSync(legacyFilePath, `${JSON.stringify(preferences, null, 2)}\n`, 'utf-8');

    expect(repository.hasPreferences()).toBe(true);
    expect(repository.read()).toEqual(preferences);
  });

  test('should add additional keywords to database preferences', () => {
    const directoryPath = createTemporaryPreferencesDirectory();
    const repository = new ScannerPreferencesFileRepository({
      directoryPath,
    });

    repository.write(defaultScannerPreferences);
    const preferences = repository.addAdditionalKeyword('exclude', 'react native');
    repository.addAdditionalKeyword('exclude', 'react native');

    expect(preferences.excludeKeywords).toEqual(['react native']);
    expect(repository.read().excludeKeywords).toEqual(['react native']);
    expect(readJsonLines(path.join(directoryPath, 'additional-keywords.jsonl'))).toEqual([
      { scope: 'exclude', keyword: 'react native' },
    ]);
  });

});
