import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import React from 'react';
import { afterEach, describe, expect, test } from 'vitest';
import { render } from 'ink-testing-library';
import { JobRuleFileRepository, PersistedJobRuleManager } from '@config/rules';
import { ScannerPreferencesFileRepository } from '@config/scanner-preferences-file.repository';
import { InkTerminalApp } from '@tui/terminal-app';
import { TerminalSessionStore } from '@tui/terminal-session.store';

const mountedApplications: Array<{ unmount: () => void }> = [];
const temporaryDirectories: string[] = [];

function createRuleManager(): PersistedJobRuleManager {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'manual-review-ui-'));
  temporaryDirectories.push(directory);

  return new PersistedJobRuleManager(new JobRuleFileRepository({
    directoryPath: directory,
    seedRules: [],
  }));
}

function createPreferencesRepository(): ScannerPreferencesFileRepository {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'manual-review-preferences-'));
  temporaryDirectories.push(directory);

  return new ScannerPreferencesFileRepository({
    directoryPath: directory,
  });
}

afterEach(() => {
  mountedApplications.splice(0).forEach((application) => {
    application.unmount();
  });
  temporaryDirectories.splice(0).forEach((directory) => {
    fs.rmSync(directory, { recursive: true, force: true });
  });
});

describe('InkTerminalApp', () => {

  test('should render the running view', async () => {
    const store = new TerminalSessionStore(true, {
      preferencesRepository: createPreferencesRepository(),
      ruleManager: createRuleManager(),
    });
    store.setContext({
      phase: 'Starting run',
    });
    const application = render(<InkTerminalApp store={store} />);

    mountedApplications.push(application);

    await Promise.resolve();

    const frame = application.lastFrame() ?? '';

    expect(frame).toContain('LinkedIn scanner is running.');
    expect(frame).toContain('Session');
    expect(frame).toContain('Rules: include 0 · exclude 0 · extra exclude 0');
    expect(frame).toContain('Found 0 · Unknown 0 · Discarded 0 · Skipped 0');
    expect(frame).not.toContain('Rule catalog');
    expect(frame).not.toContain('Shortlist');
    expect(frame).not.toContain('Review queue');
    expect(frame).toContain('exclude:');
    expect(frame).toContain('|');
    expect(frame.indexOf('Session')).toBeLessThan(frame.indexOf('Recent activity'));
  });

  test('should save exclude rules from keyboard input', async () => {
    const store = new TerminalSessionStore(true, {
      preferencesRepository: createPreferencesRepository(),
      ruleManager: createRuleManager(),
    });
    const application = render(<InkTerminalApp store={store} />);

    mountedApplications.push(application);

    application.stdin.write('typescript');
    application.stdin.write('\r');

    await Promise.resolve();

    expect(store.getSnapshot().ruleCatalog.exclude).toEqual([]);
    expect(store.getSnapshot().additionalKeywords.exclude).toEqual(['typescript']);
    expect(application.lastFrame()).toContain('Saved exclude keyword "typescript".');
  });

  test('should render the manual review view and the session summary', async () => {
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
    const application = render(<InkTerminalApp store={store} />);

    mountedApplications.push(application);

    await Promise.resolve();

    const frame = application.lastFrame() ?? '';

    expect(frame).toContain('Unknown job pending manual discard');
    expect(frame).toContain('Link: https://www.linkedin.com/jobs/view/4386875881/');
    expect(frame).toContain('Session');
    expect(frame).not.toContain('Rule catalog');
    expect(frame).not.toContain('Shortlist');
    expect(frame).not.toContain('Review queue');
    expect(frame).toContain('exclude:');
    expect(frame).toContain('|');
    expect(frame.indexOf('Session')).toBeLessThan(frame.indexOf('Recent activity'));

    store.handleInput('typescript', {});
    store.handleInput('', { return: true });

    await Promise.resolve();

    const updatedFrame = application.lastFrame() ?? '';

    expect(updatedFrame).toContain('Saved exclude keyword "typescript".');
    expect(updatedFrame).toContain('Rules: include 0 · exclude 0 · extra exclude 1');
    expect(updatedFrame).toContain('typescript');

    store.finishManualReview('4386875881');
  });
});
