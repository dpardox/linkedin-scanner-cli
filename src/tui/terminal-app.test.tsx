import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import React from 'react';
import { afterEach, describe, expect, test } from 'vitest';
import { render } from 'ink-testing-library';
import { JobRuleFileRepository, PersistedJobRuleManager } from '@config/rules';
import { ScannerPreferencesFileRepository } from '@config/scanner-preferences-file.repository';
import { Location } from '@enums/location.enum';
import { TimePostedRange } from '@enums/time-posted-range.enum';
import { WorkType } from '@enums/work-type.enum';
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
      searchQuery: '"angular"',
      location: Location.spain,
      timePostedRange: TimePostedRange.day,
      workType: WorkType.remote,
      jobId: '4386875881',
      jobTitle: 'Angular Developer',
    });
    store.trackLog('info', 'Checking if job "4386875881" is a good fit...');
    const application = render(<InkTerminalApp store={store} />);

    mountedApplications.push(application);

    await Promise.resolve();

    const frame = application.lastFrame() ?? '';

    expect(frame).toContain('LinkedIn Scanner CLI');
    expect(frame).toContain('"Angular"');
    expect(frame).toContain('Spain');
    expect(frame).toContain('last 24 hours');
    expect(frame).toContain('remotely');
    expect(frame).toMatch(/Elapsed \d{2}:\d{2}/);
    expect(frame).not.toContain('Jobs');
    expect(frame).toContain('Angular Developer - Starting run');
    expect(frame).not.toContain('Checking if job "4386875881" is a good fit...');
    expect(frame).not.toContain('Discarded');
    expect(frame).not.toContain('Skipped');
    expect(frame).not.toContain('Session');
    expect(frame).not.toContain('Rule catalog');
    expect(frame).not.toContain('Shortlist');
    expect(frame).not.toContain('Review queue');
    expect(frame).toContain('Exclude jobs containing:');
    expect(frame).toContain('keyword or phrase');
    expect(frame).not.toContain('[info]');
  });

  test('should save exclude rules from keyboard input', async () => {
    const store = new TerminalSessionStore(true, {
      preferencesRepository: createPreferencesRepository(),
      ruleManager: createRuleManager(),
    });
    store.setContext({
      phase: 'Evaluating job',
      jobId: '4386875881',
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
  });

  test('should render decision entries in chronological order before the running spinner', async () => {
    const store = new TerminalSessionStore(true, {
      preferencesRepository: createPreferencesRepository(),
      ruleManager: createRuleManager(),
    });
    store.countJob('notApplicable', {
      id: '4386875881',
      title: 'PHP Backend Developer',
      reason: 'Excluded keywords: PHP',
      criteria: ['PHP'],
    });
    store.countJob('unknown', {
      id: '4386875882',
      title: 'Senior Engineer',
      reason: 'No include or exclude keywords matched',
    });
    store.setContext({
      phase: 'Waiting manual review',
      jobId: '4386875883',
      jobTitle: 'Angular Developer',
    });
    const application = render(<InkTerminalApp store={store} />);

    mountedApplications.push(application);

    await Promise.resolve();

    const frame = application.lastFrame() ?? '';
    const notFitIndex = frame.indexOf('Not a fit PHP Backend Developer - Excluded keywords: PHP');
    const unknownIndex = frame.indexOf('Unknown Senior Engineer - No include or exclude keywords matched');
    const spinnerIndex = frame.indexOf('Angular Developer - Waiting manual review');

    expect(notFitIndex).toBeGreaterThanOrEqual(0);
    expect(unknownIndex).toBeGreaterThan(notFitIndex);
    expect(spinnerIndex).toBeGreaterThan(unknownIndex);
    expect(frame).not.toContain('4386875881');
    expect(frame).not.toContain('4386875882');
    expect(frame).not.toContain('4386875883');
  });

  test('should use the available content rows for job history', async () => {
    const store = new TerminalSessionStore(true, {
      preferencesRepository: createPreferencesRepository(),
      ruleManager: createRuleManager(),
    });

    for (let index = 1; index <= 12; index += 1) {
      store.countJob('notApplicable', {
        id: `job-${index}`,
        title: `Rejected Job ${index}`,
        reason: 'Unsupported language: eng',
      });
    }

    const application = render(<InkTerminalApp store={store} />);

    mountedApplications.push(application);

    await new Promise((resolve) => setTimeout(resolve, 0));

    const frame = application.lastFrame() ?? '';

    expect(frame).toContain('Not a fit Rejected Job 1 - Unsupported language: eng');
    expect(frame).toContain('Not a fit Rejected Job 12 - Unsupported language: eng');
  });

  test('should render the manual review job in the job list', async () => {
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

    expect(frame).not.toContain('Jobs');
    expect(frame).toContain('Unknown Angular Developer');
    expect(frame).not.toContain('https://www.linkedin.com/jobs/view/4386875881/');
    expect(frame).not.toContain('Discarded');
    expect(frame).not.toContain('Skipped');
    expect(frame).not.toContain('Session');
    expect(frame).not.toContain('Rule catalog');
    expect(frame).not.toContain('Shortlist');
    expect(frame).not.toContain('Review queue');
    expect(frame).toContain('Exclude jobs containing:');
    expect(frame).toContain('keyword or phrase');

    store.handleInput('typescript', {});
    store.handleInput('', { return: true });

    await Promise.resolve();

    const updatedFrame = application.lastFrame() ?? '';

    expect(updatedFrame).not.toContain('Saved exclusion keyword "typescript".');

    store.finishManualReview('4386875881');
  });

  test('should keep the manual review spinner stable after saving exclude keywords', async () => {
    const store = new TerminalSessionStore(true, {
      preferencesRepository: createPreferencesRepository(),
      ruleManager: createRuleManager(),
    });
    store.trackUndeterminedEntry({
      id: '4386875881',
      title: 'Fullstack Developer (React/Python)',
      link: 'https://www.linkedin.com/jobs/view/4386875881/',
      location: 'Remote',
      decision: 'pending',
    });
    store.setContext({
      phase: 'Waiting manual review',
      jobId: '4386875881',
      jobTitle: 'Fullstack Developer (React/Python)',
    });
    store.trackLog('info', 'Marking job "Fullstack Developer (React/Python)" for manual check...');
    store.startManualReview({
      id: '4386875881',
      title: 'Fullstack Developer (React/Python)',
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

    expect(frame).toContain('Fullstack Developer (React/Python) - Waiting manual review');
    expect(frame).not.toContain('Marking job "Fullstack Developer (React/Python)" for manual check...');

    store.saveExcludeKeyword('React/Python');

    await Promise.resolve();

    const updatedFrame = application.lastFrame() ?? '';

    expect(updatedFrame).toContain('Fullstack Developer (React/Python) - Waiting manual review');
    expect(updatedFrame).not.toContain('Saved exclusion keyword "React/Python".');

    store.finishManualReview('4386875881');
  });
});
