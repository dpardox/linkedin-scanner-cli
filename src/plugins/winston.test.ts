import { beforeEach, describe, expect, test, vi } from 'vitest';
import { WinstonPlugin } from './winston.plugin';

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

describe('WinstonPlugin', () => {
  let winstonPlugin: WinstonPlugin;

  beforeEach(() => {
    vi.clearAllMocks();
    winstonPlugin = new WinstonPlugin();
  });

  test('should call logger.info on info()', () => {
    winstonPlugin.info('Test info');
    expect(mockInfo).toHaveBeenCalledWith('Test info');
  });

  test('should call logger.error on error()', () => {
    winstonPlugin.error('Test error');
    expect(mockError).toHaveBeenCalledWith('Test error');
  });

  test('should call logger.warn on warn()', () => {
    winstonPlugin.warn('Test warn');
    expect(mockWarn).toHaveBeenCalledWith('Test warn');
  });

  test('should call logger.log on success()', () => {
    winstonPlugin.success('Test success');
    expect(mockLog).toHaveBeenCalledWith('success', 'Test success');
  });
});
