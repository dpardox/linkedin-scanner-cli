import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { ScannerPreferencesFileRepository } from './scanner-preferences-file.repository';
import { defaultScannerPreferences } from './default-scanner-preferences';

const temporaryDirectories: string[] = [];

function createTemporaryPreferencesPath(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'scanner-preferences-'));
  temporaryDirectories.push(directory);
  return path.join(directory, 'preferences.json');
}

describe('ScannerPreferencesFileRepository', () => {

  afterEach(() => {
    temporaryDirectories.splice(0).forEach((directory) => {
      fs.rmSync(directory, { recursive: true, force: true });
    });
  });

  test('should return default preferences when the file does not exist', () => {
    const repository = new ScannerPreferencesFileRepository(createTemporaryPreferencesPath());

    expect(repository.hasPreferences()).toBe(false);
    expect(repository.read()).toEqual(defaultScannerPreferences);
  });

  test('should persist scanner preferences', () => {
    const filePath = createTemporaryPreferencesPath();
    const repository = new ScannerPreferencesFileRepository(filePath);
    const preferences = {
      ...defaultScannerPreferences,
      searchQueries: ['react'],
      languages: ['eng'],
      showUnknownJobs: true,
    };

    repository.write(preferences);

    expect(repository.hasPreferences()).toBe(true);
    expect(repository.read()).toEqual(preferences);
  });

});
