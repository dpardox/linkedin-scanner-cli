import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@adapters/winston.adapter', () => ({
  WinstonAdapter: vi.fn()
}));

vi.mock('@adapters/sound-notification.adapter', () => ({
  SoundNotificationAdapter: vi.fn()
}));

vi.mock('@adapters/chromium.adapter', () => ({
  ChromiumAdapter: vi.fn()
}));

describe('Main', () => {

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should initialize the application', async () => {
    const runMock = vi.fn().mockResolvedValue(undefined);

    vi.doMock('@apps/job-checker.app', () => ({
      JobCheckerApp: vi.fn().mockImplementation(() => ({
        run: runMock
      }))
    }));

    await import('./main');

    expect(runMock).toHaveBeenCalled();
  });

});
