import { afterEach, describe, expect, test } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { JobRuleFileRepository } from './job-rule-file.repository';
import { PersistedJobRuleManager } from './persisted-job-rule.manager';
import { PersistedJobRule } from './persisted-job-rule.type';

function createRepositoryDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'persisted-job-rules-'));
  createdDirectories.push(directory);
  return directory;
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

const createdDirectories: string[] = [];

describe('PersistedJobRuleManager', () => {

  afterEach(() => {
    createdDirectories.splice(0).forEach((directory) => {
      fs.rmSync(directory, { recursive: true, force: true });
    });
  });

  test('should seed one JSON file per keyword package when the directory is empty', () => {
    const directoryPath = createRepositoryDirectory();
    const repository = new JobRuleFileRepository({
      directoryPath,
      seedRules: [
        {
          id: 'angular',
          name: 'Angular',
          kind: 'keyword',
          terms: ['Angular', 'AngularJS'],
        },
        {
          id: 'english',
          name: 'English',
          kind: 'keyword',
          terms: ['English'],
        },
      ],
    });

    expect(fs.existsSync(path.join(directoryPath, 'angular.json'))).toBe(true);
    expect(fs.existsSync(path.join(directoryPath, 'english.json'))).toBe(true);
    expect(repository.list()).toHaveLength(2);
    expect(readJsonFile<PersistedJobRule>(path.join(directoryPath, 'angular.json'))).toEqual({
      id: 'angular',
      name: 'Angular',
      kind: 'keyword',
      terms: ['Angular', 'AngularJS'],
    });
  });

  test('should keep rules normalized in their JSON file', () => {
    const directoryPath = createRepositoryDirectory();
    const repository = new JobRuleFileRepository({
      directoryPath,
      seedRules: [],
    });

    repository.upsert({
      id: ' backend ',
      name: ' Backend ',
      kind: 'keyword',
      terms: ['Laravel', 'Laravel', ' Symfony '],
    });

    const rules = repository.list();

    expect(rules).toEqual([
      {
        id: 'backend',
        name: 'Backend',
        kind: 'keyword',
        terms: ['Laravel', 'Symfony'],
      },
    ]);

    expect(readJsonFile<PersistedJobRule>(path.join(directoryPath, 'backend.json'))).toEqual(rules[0]);
  });

  test('should migrate legacy scoped files into one JSON file per keyword package', () => {
    const directoryPath = createRepositoryDirectory();
    fs.writeFileSync(path.join(directoryPath, 'include.jsonl'), [
      JSON.stringify({
        id: 'angular',
        name: 'Angular',
        kind: 'keyword',
        scope: 'include',
        terms: ['Angular'],
      }),
    ].join('\n'), 'utf-8');
    fs.writeFileSync(path.join(directoryPath, 'exclude.jsonl'), [
      JSON.stringify({
        id: 'english',
        name: 'English',
        kind: 'keyword',
        scope: 'exclude',
        terms: ['English'],
      }),
    ].join('\n'), 'utf-8');

    const repository = new JobRuleFileRepository({
      directoryPath,
      seedRules: [],
    });

    expect(repository.list().map(({ id }) => id)).toEqual(['angular', 'english']);
    expect(readJsonFile<PersistedJobRule>(path.join(directoryPath, 'angular.json'))).toEqual({
      id: 'angular',
      name: 'Angular',
      kind: 'keyword',
      terms: ['Angular'],
    });
    expect(readJsonFile<PersistedJobRule>(path.join(directoryPath, 'english.json'))).toEqual({
      id: 'english',
      name: 'English',
      kind: 'keyword',
      terms: ['English'],
    });
  });

  test('should migrate legacy catalog files into one JSON file per keyword package', () => {
    const directoryPath = createRepositoryDirectory();
    fs.writeFileSync(path.join(directoryPath, 'catalog.jsonl'), [
      JSON.stringify({
        id: 'angular',
        name: 'Angular',
        kind: 'keyword',
        terms: ['Angular'],
      }),
      JSON.stringify({
        id: 'english',
        name: 'English',
        kind: 'keyword',
        terms: ['English'],
      }),
    ].join('\n'), 'utf-8');

    const repository = new JobRuleFileRepository({
      directoryPath,
      seedRules: [],
    });

    expect(repository.list().map(({ id }) => id)).toEqual(['angular', 'english']);
    expect(readJsonFile<PersistedJobRule>(path.join(directoryPath, 'angular.json'))).toEqual({
      id: 'angular',
      name: 'Angular',
      kind: 'keyword',
      terms: ['Angular'],
    });
  });

  test('should migrate legacy skill rule kinds into keyword rule kinds', () => {
    const directoryPath = createRepositoryDirectory();
    fs.writeFileSync(path.join(directoryPath, 'include.jsonl'), [
      JSON.stringify({
        id: 'angular',
        name: 'Angular',
        kind: 'skill',
        scope: 'include',
        terms: ['Angular'],
      }),
    ].join('\n'), 'utf-8');

    const repository = new JobRuleFileRepository({
      directoryPath,
      seedRules: [],
    });

    expect(repository.list()).toEqual([
      {
        id: 'angular',
        name: 'Angular',
        kind: 'keyword',
        terms: ['Angular'],
      },
    ]);
  });

  test('should flatten selected rules into matching keywords', () => {
    const repository = new JobRuleFileRepository({
      directoryPath: createRepositoryDirectory(),
      seedRules: [
        {
          id: 'angular',
          name: 'Angular',
          kind: 'keyword',
          terms: ['Angular', 'AngularJS'],
        },
        {
          id: 'english',
          name: 'English',
          kind: 'keyword',
          terms: ['English B2', 'English C1'],
        },
        {
          id: 'backend',
          name: 'Backend',
          kind: 'term',
          terms: ['Symfony', 'Laravel'],
        },
      ],
    });
    const manager = new PersistedJobRuleManager(repository);

    expect(manager.listRules().map(({ id }) => id)).toEqual(['angular', 'backend', 'english']);
    expect(manager.createKeywords({
      includeRuleIds: ['angular'],
      excludeRuleIds: ['english', 'backend'],
      includeKeywords: ['Angular'],
      excludeKeywords: ['Laravel', 'FastAPI'],
    })).toEqual({
      include: ['Angular', 'AngularJS'],
      exclude: ['English B2', 'English C1', 'Symfony', 'Laravel', 'FastAPI'],
    });
  });

  test('should update and delete persisted rules', () => {
    const repository = new JobRuleFileRepository({
      directoryPath: createRepositoryDirectory(),
      seedRules: [
        {
          id: 'angular',
          name: 'Angular',
          kind: 'keyword',
          terms: ['Angular'],
        },
      ],
    });
    const manager = new PersistedJobRuleManager(repository);

    manager.upsertRule({
      id: 'angular',
      name: 'Angular frontend',
      kind: 'keyword',
      terms: ['Angular', 'RxJS'],
    });

    expect(manager.listRules()).toEqual([
      {
        id: 'angular',
        name: 'Angular frontend',
        kind: 'keyword',
        terms: ['Angular', 'RxJS'],
      },
    ]);

    expect(manager.deleteRule('angular')?.id).toBe('angular');
    expect(manager.listRules()).toEqual([]);
  });

});
