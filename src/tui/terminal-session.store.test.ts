import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { JobRuleFileRepository, PersistedJobRuleManager } from '@config/rules';
import { ScannerPreferencesFileRepository } from '@config/scanner-preferences-file.repository';
import { TerminalInputKey, TerminalSessionStore } from '@tui/terminal-session.store';

const temporaryDirectories: string[] = [];

function createRuleManager(): PersistedJobRuleManager {
  const rulesDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'terminal-session-store-'));
  temporaryDirectories.push(rulesDirectory);

  return new PersistedJobRuleManager(new JobRuleFileRepository({
    directoryPath: rulesDirectory,
    seedRules: [],
  }));
}

function createPreferencesRepository(): ScannerPreferencesFileRepository {
  const preferencesDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'terminal-session-preferences-'));
  temporaryDirectories.push(preferencesDirectory);

  return new ScannerPreferencesFileRepository({
    directoryPath: preferencesDirectory,
  });
}

function createInputKey(overrides: Partial<TerminalInputKey> = {}): TerminalInputKey {
  return {
    ctrl: false,
    downArrow: false,
    escape: false,
    leftArrow: false,
    return: false,
    rightArrow: false,
    tab: false,
    upArrow: false,
    backspace: false,
    delete: false,
    home: false,
    end: false,
    ...overrides,
  };
}

describe('TerminalSessionStore', () => {

  afterEach(() => {
    temporaryDirectories.splice(0).forEach((rulesDirectory) => {
      fs.rmSync(rulesDirectory, { recursive: true, force: true });
    });
  });

  test('should save exclude rules from the footer input while the scanner is running', () => {
    const store = new TerminalSessionStore(true, {
      preferencesRepository: createPreferencesRepository(),
      ruleManager: createRuleManager(),
    });

    store.handleInput('n', createInputKey());
    store.handleInput('o', createInputKey());
    store.handleInput('d', createInputKey());
    store.handleInput('e', createInputKey());
    store.handleInput('', createInputKey({ return: true }));

    expect(store.getSnapshot().additionalKeywords.exclude).toEqual(['node']);
    expect(store.getSnapshot().ruleCatalog.exclude).toEqual([]);
    expect(store.getSnapshot().excludeDraft.value).toBe('');
    expect(store.getSnapshot().excludeDraft.cursorOffset).toBe(0);
  });

  test('should track spawn actions for terminal feedback', () => {
    const store = new TerminalSessionStore(true, {
      preferencesRepository: createPreferencesRepository(),
      ruleManager: createRuleManager(),
    });

    const action = store.startAction({
      runningText: 'Saving scanner configuration',
      successText: 'Saved scanner configuration',
      failureText: 'Failed to save scanner configuration',
    });

    expect(store.getSnapshot().spawnActions[0]).toMatchObject({
      id: action.id,
      runningText: 'Saving scanner configuration',
      successText: 'Saved scanner configuration',
      failureText: 'Failed to save scanner configuration',
    });

    store.completeAction(action.id);

    expect(fs.existsSync(action.statusFilePath)).toBe(true);

    store.removeActionResources(action.id);

    expect(fs.existsSync(path.dirname(action.statusFilePath))).toBe(false);
  });

  test('should save exclude rules from prefixed footer input', () => {
    const store = new TerminalSessionStore(true, {
      preferencesRepository: createPreferencesRepository(),
      ruleManager: createRuleManager(),
    });

    store.handleInput('exclude: node', createInputKey());
    store.handleInput('', createInputKey({ return: true }));

    expect(store.getSnapshot().additionalKeywords.exclude).toEqual(['node']);
  });

  test('should save exclude rules during manual review and dismiss unknown jobs when review finishes', () => {
    const store = new TerminalSessionStore(true, {
      preferencesRepository: createPreferencesRepository(),
      ruleManager: createRuleManager(),
    });

    store.trackUndeterminedEntry({
      id: '4386875881',
      title: 'Angular Developer',
      link: 'https://www.linkedin.com/jobs/view/4386875881/',
      location: 'Remote',
      decision: 'pending',
    });
    store.startManualReview({
      id: '4386875881',
      title: 'Angular Developer',
      link: 'https://www.linkedin.com/jobs/view/4386875881/',
      location: 'Remote',
      emails: [],
      language: 'eng',
      criteria: ['Unknown'],
      classification: 'unknown',
      defaultRuleScope: 'exclude',
    });

    store.handleInput('t', createInputKey());
    store.handleInput('y', createInputKey());
    store.handleInput('p', createInputKey());
    store.handleInput('e', createInputKey());
    store.handleInput('s', createInputKey());
    store.handleInput('c', createInputKey());
    store.handleInput('r', createInputKey());
    store.handleInput('i', createInputKey());
    store.handleInput('p', createInputKey());
    store.handleInput('t', createInputKey());
    store.handleInput('', createInputKey({ return: true }));

    expect(store.getSnapshot().additionalKeywords.exclude).toEqual(['typescript']);

    store.finishManualReview('4386875881');

    expect(store.getSnapshot().manualReviewState).toBeUndefined();
    expect(store.getSnapshot().undeterminedEntries[0].decision).toBe('dismissed');
    expect(store.getSnapshot().excludeDraft.value).toBe('');
  });

  test('should track logs counters shortlist and saved rules', () => {
    const store = new TerminalSessionStore(false, {
      preferencesRepository: createPreferencesRepository(),
      ruleManager: createRuleManager(),
    });

    store.setContext({
      phase: 'Scanning jobs list',
    });
    store.countJob('forMe');
    store.countJob('unknown');
    store.trackLog('info', 'Scanning jobs');
    store.addForYouEntry({
      id: '4386875881',
      title: 'Angular Developer',
      link: 'https://www.linkedin.com/jobs/view/4386875881/',
      location: 'Remote',
      emails: [],
      language: 'eng',
      criteria: ['Angular'],
    });

    const snapshot = store.getSnapshot();

    expect(snapshot.context.phase).toBe('Scanning jobs list');
    expect(snapshot.jobCounts.forMe).toBe(1);
    expect(snapshot.jobCounts.unknown).toBe(1);
    expect(snapshot.recentLogs[0].message).toBe('Scanning jobs');
    expect(snapshot.forYouEntries[0].title).toBe('Angular Developer');
    expect(snapshot.ruleCatalog.include).toEqual([]);
    expect(snapshot.ruleCatalog.exclude).toEqual([]);
  });

  test('should reclassify counted jobs by id', () => {
    const store = new TerminalSessionStore(false, {
      preferencesRepository: createPreferencesRepository(),
      ruleManager: createRuleManager(),
    });

    store.countJob('notApplicable', '4386875881');
    store.countJob('forMe', '4386875881');
    store.countJob('forMe', '4386875881');

    const snapshot = store.getSnapshot();

    expect(snapshot.jobCounts.notApplicable).toBe(0);
    expect(snapshot.jobCounts.forMe).toBe(1);
    expect(snapshot.jobCounts.unknown).toBe(0);
  });
});
