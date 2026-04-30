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
    store.trackLog('info', 'Checking if job "4386875881" is a good fit...');
    const application = render(<InkTerminalApp store={store} />);

    mountedApplications.push(application);

    await Promise.resolve();

    const frame = application.lastFrame() ?? '';

    expect(frame).toContain('LinkedIn scanner is running.');
    expect(frame).toContain('LinkedIn Scanner CLI');
    expect(frame).toContain('Session');
    expect(frame).toMatch(/include rules 0 \| exclusion rules 0\s+\|?\s*custom exclusions 0/);
    expect(frame).toContain('Jobs');
    expect(frame).toMatch(/Good fit\s+0/);
    expect(frame).toMatch(/Not a fit\s+0/);
    expect(frame).toMatch(/Unknown\s+0/);
    expect(frame).not.toContain('Discarded');
    expect(frame).not.toContain('Skipped');
    expect(frame).not.toContain('Rule catalog');
    expect(frame).not.toContain('Shortlist');
    expect(frame).not.toContain('Review queue');
    expect(frame).toContain('Exclude jobs containing:');
    expect(frame).toContain('keyword or phrase');
    expect(frame).toContain('Checking if job "4386875881" is a good fit...');
    expect(frame).not.toContain('[info]');
    expect(frame.indexOf('Session')).toBeLessThan(frame.indexOf('Activity'));
  });

  test('should save exclude rules from keyboard input', async () => {
    const store = new TerminalSessionStore(true, {
      preferencesRepository: createPreferencesRepository(),
      ruleManager: createRuleManager(),
    });
    const application = render(<InkTerminalApp store={store} />);

    mountedApplications.push(application);

    await new Promise((resolve) => setTimeout(resolve, 0));

    for (const character of 'typescript') {
      application.stdin.write(character);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    application.stdin.write('\r');

    await Promise.resolve();

    expect(store.getSnapshot().ruleCatalog.exclude).toEqual([]);
    expect(store.getSnapshot().additionalKeywords.exclude).toEqual(['typescript']);
    expect(application.lastFrame()).toContain('Saved exclusion keyword "typescript".');
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
    store.countJob('unknown');
    for (let i = 0; i < 100; i += 1) {
      store.countJob('notApplicable');
    }
    const application = render(<InkTerminalApp store={store} />);

    mountedApplications.push(application);

    await Promise.resolve();

    const frame = application.lastFrame() ?? '';

    expect(frame).toContain('Unknown job pending manual discard');
    expect(frame).toContain('Link: https://www.linkedin.com/jobs/view/4386875881/');
    expect(frame).toContain('Session');
    expect(frame).toContain('Jobs');
    expect(frame).toMatch(/Good fit\s+0/);
    expect(frame).toMatch(/Unknown\s+1/);
    expect(frame).toMatch(/Not a fit\s+100/);
    expect(frame).not.toContain('Discarded');
    expect(frame).not.toContain('Skipped');
    expect(frame).not.toContain('Rule catalog');
    expect(frame).not.toContain('Shortlist');
    expect(frame).not.toContain('Review queue');
    expect(frame).toContain('Exclude jobs containing:');
    expect(frame).toContain('keyword or phrase');
    expect(frame.indexOf('Session')).toBeLessThan(frame.indexOf('Activity'));

    store.handleInput('typescript', {});
    store.handleInput('', { return: true });

    await Promise.resolve();

    const updatedFrame = application.lastFrame() ?? '';

    expect(updatedFrame).toContain('Saved exclusion keyword "typescript".');
    expect(updatedFrame).toMatch(/include rules 0 \| exclusion rules 0\s+\|?\s*custom exclusions 1/);
    expect(updatedFrame).toContain('typescript');

    store.finishManualReview('4386875881');
  });
});
