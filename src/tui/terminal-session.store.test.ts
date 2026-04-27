import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { JobRuleFileRepository, PersistedJobRuleManager } from '@config/rules';
import { TerminalInputKey, TerminalSessionStore } from '@tui/terminal-session.store';

const temporaryDirectories: string[] = [];

function createRuleManager(): PersistedJobRuleManager {
  const rulesDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'terminal-session-store-'));
  temporaryDirectories.push(rulesDirectory);

  return new PersistedJobRuleManager(new JobRuleFileRepository({
    filePath: path.join(rulesDirectory, 'catalog.jsonl'),
    seedRules: [],
  }));
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
      ruleManager: createRuleManager(),
    });

    store.handleInput('n', createInputKey());
    store.handleInput('o', createInputKey());
    store.handleInput('d', createInputKey());
    store.handleInput('e', createInputKey());
    store.handleInput('', createInputKey({ return: true }));

    expect(store.getSnapshot().ruleCatalog.exclude).toEqual([
      {
        id: 'exclude-node',
        name: 'node',
        kind: 'term',
        scope: 'exclude',
        terms: ['node'],
      },
    ]);
    expect(store.getSnapshot().excludeDraft.value).toBe('');
    expect(store.getSnapshot().excludeDraft.cursorOffset).toBe(0);
  });

  test('should save exclude rules from prefixed footer input', () => {
    const store = new TerminalSessionStore(true, {
      ruleManager: createRuleManager(),
    });

    store.handleInput('exclude: node', createInputKey());
    store.handleInput('', createInputKey({ return: true }));

    expect(store.getSnapshot().ruleCatalog.exclude).toEqual([
      {
        id: 'exclude-node',
        name: 'node',
        kind: 'term',
        scope: 'exclude',
        terms: ['node'],
      },
    ]);
  });

  test('should save exclude rules during manual review and dismiss unknown jobs when review finishes', () => {
    const store = new TerminalSessionStore(true, {
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

    expect(store.getSnapshot().ruleCatalog.exclude).toEqual([
      {
        id: 'exclude-typescript',
        name: 'typescript',
        kind: 'term',
        scope: 'exclude',
        terms: ['typescript'],
      },
    ]);

    store.finishManualReview('4386875881');

    expect(store.getSnapshot().manualReviewState).toBeUndefined();
    expect(store.getSnapshot().undeterminedEntries[0].decision).toBe('dismissed');
    expect(store.getSnapshot().excludeDraft.value).toBe('');
  });

  test('should track logs counters shortlist and saved rules', () => {
    const store = new TerminalSessionStore(false, {
      ruleManager: createRuleManager(),
    });

    store.setContext({
      phase: 'Scanning jobs list',
    });
    store.countJob('found');
    store.countJob('undetermined');
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
    expect(snapshot.jobCounts.found).toBe(1);
    expect(snapshot.jobCounts.undetermined).toBe(1);
    expect(snapshot.recentLogs[0].message).toBe('Scanning jobs');
    expect(snapshot.forYouEntries[0].title).toBe('Angular Developer');
    expect(snapshot.ruleCatalog.include).toEqual([]);
    expect(snapshot.ruleCatalog.exclude).toEqual([]);
  });
});
