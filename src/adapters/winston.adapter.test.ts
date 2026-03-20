import { beforeEach, describe, expect, test, vi } from 'vitest';
import { WinstonAdapter } from './winston.adapter';

const mockLog = vi.fn();
const mockInfo = vi.fn();
const mockWarn = vi.fn();
const mockError = vi.fn();

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

describe('WinstonAdapter', () => {
  let winstonAdapter: WinstonAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    winstonAdapter = new WinstonAdapter();
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

  test('should keep recent activity visible outside manual check', () => {
    winstonAdapter.forYou({
      id: '4386875881',
      title: 'Programador full stack',
      link: 'https://www.linkedin.com/jobs/view/4386875881/',
      location: 'Canary Islands, Spain',
      emails: [],
      language: 'spa',
      criteria: ['Angular'],
    });

    expect(mockLog).toHaveBeenCalledWith('success', 'For you "%O"', {
      id: '4386875881',
      title: 'Programador full stack',
      link: 'https://www.linkedin.com/jobs/view/4386875881/',
      location: 'Canary Islands, Spain',
      emails: [],
      language: 'spa',
      criteria: ['Angular'],
    });
    expect((winstonAdapter as any).recentLogs).toHaveLength(0);
    expect((winstonAdapter as any).forYouEntries).toHaveLength(1);

    const screen = (winstonAdapter as any).buildScreen();
    expect(screen).toContain('Recent activity:');
    expect(screen).toContain('waiting for events...');
    expect(screen).not.toContain('For you:');
  });

  test('should replace recent activity with for you during manual check', () => {
    winstonAdapter.forYou({
      id: '4386875881',
      title: 'Programador full stack',
      link: 'https://www.linkedin.com/jobs/view/4386875881/',
      location: 'Canary Islands, Spain',
      emails: [],
      language: 'spa',
      criteria: ['Angular', 'High skills match'],
    });

    winstonAdapter.setContext({ phase: 'Waiting manual review', jobId: '4386875881' });

    const screen = (winstonAdapter as any).buildScreen();
    expect(screen).toContain('For you:');
    expect(screen).toContain('Programador full stack');
    expect(screen).not.toContain('1. Programador full stack');
    expect(screen).toContain('Criteria: Angular, High skills match');
    expect(screen).toContain('Review: pending manual check');
    expect(screen).not.toContain('Recent activity:');
  });
});
