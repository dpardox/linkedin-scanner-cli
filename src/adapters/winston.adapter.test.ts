import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { JobRuleFileRepository, PersistedJobRuleManager } from '@config/rules';
import { PersistedJobRule } from '@config/rules/persisted-job-rule.type';
import { ScannerPreferences } from '@shared/types/scanner-preferences.type';
import { WinstonAdapter } from './winston.adapter';

const mockLog = vi.fn();
const mockInfo = vi.fn();
const mockWarn = vi.fn();
const mockError = vi.fn();
const mockLoggerClose = vi.fn();
const mockRender = vi.hoisted(() => vi.fn(() => ({
  unmount: vi.fn(),
})));
const mockAskTerminalText = vi.hoisted(() => vi.fn(async (_title: string, defaultValue: string) => defaultValue));
const mockSelectTerminalOptions = vi.hoisted(() => vi.fn(async ({ selectedValues }) => selectedValues));
const temporaryDirectories: string[] = [];

type WinstonAdapterProcessListeners = WinstonAdapter & {
  handleInterrupt: () => void;
  restoreTerminal: () => void;
};

function createRuleManager(seedRules: PersistedJobRule[] = []): PersistedJobRuleManager {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'winston-adapter-rules-'));
  temporaryDirectories.push(directory);

  return new PersistedJobRuleManager(new JobRuleFileRepository({
    directoryPath: directory,
    seedRules,
  }));
}

function setProcessTTY(isTTY: boolean): () => void {
  const stdinDescriptor = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
  const stdoutDescriptor = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');

  Object.defineProperty(process.stdin, 'isTTY', {
    configurable: true,
    value: isTTY,
  });
  Object.defineProperty(process.stdout, 'isTTY', {
    configurable: true,
    value: isTTY,
  });

  return () => {
    restoreProcessTTY(process.stdin, stdinDescriptor);
    restoreProcessTTY(process.stdout, stdoutDescriptor);
  };
}

function restoreProcessTTY(stream: NodeJS.ReadStream | NodeJS.WriteStream, descriptor?: PropertyDescriptor): void {
  if (descriptor) {
    Object.defineProperty(stream, 'isTTY', descriptor);
    return;
  }

  delete (stream as { isTTY?: boolean }).isTTY;
}

function removeWinstonAdapterProcessListeners(winstonAdapter: WinstonAdapter): void {
  const processListeners = winstonAdapter as WinstonAdapterProcessListeners;

  process.removeListener('exit', processListeners.restoreTerminal);
  process.removeListener('SIGINT', processListeners.handleInterrupt);
}

vi.mock('ink', () => ({
  Box: ({ children }: { children?: React.ReactNode }) => children,
  Text: ({ children }: { children?: React.ReactNode }) => children,
  render: mockRender,
  useInput: vi.fn(),
}));

vi.mock('winston', () => ({
  createLogger: () => ({
    log: mockLog,
    info: mockInfo,
    warn: mockWarn,
    error: mockError,
    close: mockLoggerClose,
  }),
  format: {
    combine: vi.fn(),
    timestamp: vi.fn(),
    splat: vi.fn(),
    json: vi.fn(),
    colorize: vi.fn(),
    printf: vi.fn(),
  },
  transports: {
    Console: vi.fn(),
    File: vi.fn(),
  },
}));

vi.mock('@tui/text-prompt', () => ({
  askTerminalText: mockAskTerminalText,
}));

vi.mock('@tui/multi-select-prompt', () => ({
  selectTerminalOptions: mockSelectTerminalOptions,
}));

describe('WinstonAdapter', () => {
  let winstonAdapter: WinstonAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    winstonAdapter = new WinstonAdapter({
      ruleManager: createRuleManager(),
    });
  });

  afterEach(() => {
    temporaryDirectories.splice(0).forEach((directory) => {
      fs.rmSync(directory, { recursive: true, force: true });
    });
  });

  test('should call logger.info on info()', () => {
    winstonAdapter.info('Test info');
    expect(mockInfo).toHaveBeenCalledWith('Test info');
  });

  test('should call logger.error on error()', () => {
    winstonAdapter.error('Test error');
    expect(mockError).toHaveBeenCalledWith('Test error');
  });

  test('should call logger.warn on warn()', () => {
    winstonAdapter.warn('Test warn');
    expect(mockWarn).toHaveBeenCalledWith('Test warn');
  });

  test('should call logger.log on success()', () => {
    winstonAdapter.success('Test success');
    expect(mockLog).toHaveBeenCalledWith('success', 'Test success');
  });

  test('should track shortlist unknown queue and manual review dismissal in the terminal session store', () => {
    winstonAdapter.forYou({
      id: '4386875881',
      title: 'Programador full stack',
      link: 'https://www.linkedin.com/jobs/view/4386875881/',
      location: 'Canary Islands, Spain',
      emails: [],
      language: 'spa',
      criteria: ['Angular'],
    });

    winstonAdapter.trackUndetermined({
      id: '4386875882',
      title: 'Frontend Engineer',
      link: 'https://www.linkedin.com/jobs/view/4386875882/',
      location: 'Bogota',
      decision: 'pending',
    });

    winstonAdapter.startManualReview({
      id: '4386875882',
      title: 'Frontend Engineer',
      link: 'https://www.linkedin.com/jobs/view/4386875882/',
      location: 'Bogota',
      emails: [],
      language: 'eng',
      criteria: ['Unknown'],
      classification: 'unknown',
      defaultRuleScope: 'exclude',
    });
    winstonAdapter.finishManualReview('4386875882');

    const snapshot = (winstonAdapter as any).terminalSessionStore.getSnapshot();

    expect(snapshot.forYouEntries).toHaveLength(1);
    expect(snapshot.forYouEntries[0].title).toBe('Programador full stack');
    expect(snapshot.undeterminedEntries).toHaveLength(1);
    expect(snapshot.undeterminedEntries[0].decision).toBe('dismissed');
  });

  test('should store counters context and rule catalog in the terminal session store', async () => {
    winstonAdapter.setContext({
      phase: 'Session setup',
    });
    winstonAdapter.countJob('forMe');
    winstonAdapter.countJob('unknown');

    await expect(winstonAdapter.selectExecutionOptions({ showUnknownJobs: false })).resolves.toEqual({
      showUnknownJobs: false,
    });

    const snapshot = (winstonAdapter as any).terminalSessionStore.getSnapshot();

    expect(snapshot.context.phase).toBe('Session setup');
    expect(snapshot.jobCounts.forMe).toBe(1);
    expect(snapshot.jobCounts.unknown).toBe(1);
    expect(snapshot.ruleCatalog.include).toEqual([]);
    expect(snapshot.ruleCatalog.exclude).toEqual([]);
  });

  test('should keep terminal input active after selecting execution options', async () => {
    const restoreProcessTTY = setProcessTTY(true);
    const resume = vi.spyOn(process.stdin, 'resume').mockReturnValue(process.stdin);
    const interactiveWinstonAdapter = new WinstonAdapter({
      ruleManager: createRuleManager(),
    });

    try {
      await expect(interactiveWinstonAdapter.selectExecutionOptions({ showUnknownJobs: false })).resolves.toEqual({
        showUnknownJobs: false,
      });

      expect(mockRender).toHaveBeenCalledOnce();
      expect(resume).toHaveBeenCalledOnce();
    } finally {
      removeWinstonAdapterProcessListeners(interactiveWinstonAdapter);
      resume.mockRestore();
      restoreProcessTTY();
    }
  });

  test('should close terminal session resources', async () => {
    const restoreProcessTTY = setProcessTTY(true);
    const pause = vi.spyOn(process.stdin, 'pause').mockReturnValue(process.stdin);
    const interactiveWinstonAdapter = new WinstonAdapter({
      ruleManager: createRuleManager(),
    });

    try {
      await expect(interactiveWinstonAdapter.selectExecutionOptions({ showUnknownJobs: false })).resolves.toEqual({
        showUnknownJobs: false,
      });

      const inkRenderer = mockRender.mock.results[0].value;

      interactiveWinstonAdapter.close();

      expect(inkRenderer.unmount).toHaveBeenCalledOnce();
      expect(pause).toHaveBeenCalledOnce();
      expect(mockLoggerClose).toHaveBeenCalledOnce();
    } finally {
      removeWinstonAdapterProcessListeners(interactiveWinstonAdapter);
      pause.mockRestore();
      restoreProcessTTY();
    }
  });

  test('should start scanner preferences with saved values', async () => {
    const restoreProcessTTY = setProcessTTY(true);
    const preferences: ScannerPreferences = {
      searchQueries: ['angular'],
      locationKeys: ['colombia'],
      languages: ['spa'],
      restrictedLocations: [],
      filters: {
        easyApply: true,
      },
      includeRuleIds: ['angular'],
      excludeRuleIds: ['english'],
      includeKeywords: [],
      excludeKeywords: [],
      contentSearchQuery: '"desarrollador angular"',
      showUnknownJobs: false,
    };
    const interactiveWinstonAdapter = new WinstonAdapter({
      ruleManager: createRuleManager([
        {
          id: 'angular',
          name: 'Angular',
          kind: 'keyword',
          terms: ['Angular'],
        },
        {
          id: 'english',
          name: 'English',
          kind: 'keyword',
          terms: ['English'],
        },
        {
          id: 'dotnet',
          name: '.NET',
          kind: 'keyword',
          terms: ['.NET'],
        },
        {
          id: 'us-citizenship',
          name: 'US citizenship',
          kind: 'term',
          terms: ['MUST BE A US CITIZEN'],
        },
      ]),
    });

    try {
      await expect(interactiveWinstonAdapter.selectScannerPreferences(preferences)).resolves.toEqual(preferences);

      expect(mockAskTerminalText).toHaveBeenCalledWith(
        'Which search queries should LinkedIn scan?',
        'angular',
        'Separate multiple search queries with commas. Press Enter to keep the current value.',
      );
      expect(mockAskTerminalText).toHaveBeenCalledWith(
        'Which LinkedIn posts search should open at the end?',
        '"desarrollador angular"',
        'This posts search opens after the job scan. Press Enter to keep the current value.',
      );
      expect(mockSelectTerminalOptions).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Where should LinkedIn search jobs?',
        detail: 'Select one or more countries or locations. Press Enter to keep the current selection.',
        selectedValues: ['colombia'],
      }));
      expect(mockSelectTerminalOptions).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Which keyword groups should mark a job as relevant?',
        detail: 'Select the keyword groups that should include a job. Press Enter to keep the current selection.',
        options: [
          {
            label: 'Angular',
            value: 'angular',
          },
          {
            label: '.NET',
            value: 'dotnet',
          },
          {
            label: 'English',
            value: 'english',
          },
        ],
        selectedValues: ['angular'],
      }));
      expect(mockSelectTerminalOptions).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Which keyword groups should discard a job?',
        detail: 'Select keyword groups or terms that should exclude a job. Press Enter to keep the current selection.',
        options: [
          {
            label: '.NET',
            value: 'dotnet',
          },
          {
            label: 'English',
            value: 'english',
          },
          {
            label: 'US citizenship',
            value: 'us-citizenship',
          },
        ],
        selectedValues: ['english'],
      }));
      expect(mockSelectTerminalOptions).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Should unknown jobs be reviewed manually?',
        detail: 'Select Yes to open them for review or No to mark them as unknown automatically.',
        selectedValues: ['n'],
      }));
      expect(mockRender).not.toHaveBeenCalled();
    } finally {
      removeWinstonAdapterProcessListeners(interactiveWinstonAdapter);
      restoreProcessTTY();
    }
  });
});
