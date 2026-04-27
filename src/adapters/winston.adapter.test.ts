import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { JobRuleFileRepository, PersistedJobRuleManager } from '@config/rules';
import { WinstonAdapter } from './winston.adapter';

const mockLog = vi.fn();
const mockInfo = vi.fn();
const mockWarn = vi.fn();
const mockError = vi.fn();
const mockRender = vi.hoisted(() => vi.fn(() => ({
  unmount: vi.fn(),
})));
const mockQuestion = vi.hoisted(() => vi.fn());
const mockClose = vi.hoisted(() => vi.fn());
const temporaryDirectories: string[] = [];

type WinstonAdapterProcessListeners = WinstonAdapter & {
  handleInterrupt: () => void;
  restoreTerminal: () => void;
};

function createRuleManager(): PersistedJobRuleManager {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'winston-adapter-rules-'));
  temporaryDirectories.push(directory);

  return new PersistedJobRuleManager(new JobRuleFileRepository({
    filePath: path.join(directory, 'catalog.jsonl'),
    seedRules: [],
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

vi.mock('node:readline/promises', () => ({
  createInterface: vi.fn(() => ({
    close: mockClose,
    question: mockQuestion,
  })),
}));

describe('WinstonAdapter', () => {
  let winstonAdapter: WinstonAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuestion.mockResolvedValue('');
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
    winstonAdapter.countJob('found');
    winstonAdapter.countJob('undetermined');

    await expect(winstonAdapter.selectExecutionOptions({ showUnknownJobs: false })).resolves.toEqual({
      showUnknownJobs: false,
    });

    const snapshot = (winstonAdapter as any).terminalSessionStore.getSnapshot();

    expect(snapshot.context.phase).toBe('Session setup');
    expect(snapshot.jobCounts.found).toBe(1);
    expect(snapshot.jobCounts.undetermined).toBe(1);
    expect(snapshot.ruleCatalog.include).toEqual([]);
    expect(snapshot.ruleCatalog.exclude).toEqual([]);
  });

  test('should keep terminal input active after asking execution options', async () => {
    const restoreProcessTTY = setProcessTTY(true);
    const resume = vi.spyOn(process.stdin, 'resume').mockReturnValue(process.stdin);
    const interactiveWinstonAdapter = new WinstonAdapter({
      ruleManager: createRuleManager(),
    });

    try {
      await expect(interactiveWinstonAdapter.selectExecutionOptions({ showUnknownJobs: false })).resolves.toEqual({
        showUnknownJobs: false,
      });

      expect(mockQuestion).toHaveBeenCalledWith('Show unknown jobs? (y/N) ');
      expect(mockClose).toHaveBeenCalledOnce();
      expect(mockRender).toHaveBeenCalledOnce();
      expect(resume).toHaveBeenCalledOnce();
    } finally {
      removeWinstonAdapterProcessListeners(interactiveWinstonAdapter);
      resume.mockRestore();
      restoreProcessTTY();
    }
  });
});
