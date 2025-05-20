import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@plugins/winston.plugin', () => ({
  WinstonPlugin: vi.fn()
}));

vi.mock('@plugins/sound-notification.plugin', () => ({
  SoundNotificationAdapter: vi.fn()
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
