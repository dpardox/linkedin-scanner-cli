import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@plugins/winston.plugin', () => ({
  WinstonPlugin: vi.fn()
}));

vi.mock('@plugins/sound-notification.plugin', () => ({
  SoundNotificationAdapter: vi.fn()
}));

vi.mock('@plugins/text.plugin', () => ({
  TextPlugin: vi.fn()
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

  test('should catch and log errors', async () => {
    const fakeError = new Error('Fake error');

    vi.doMock('@apps/job-checker.app', () => ({
      JobCheckerApp: vi.fn().mockImplementation(() => ({
        run: vi.fn().mockRejectedValue(fakeError)
      }))
    }));

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await import('./main');

    expect(spy).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith('App initialization failed:', fakeError);
  });

});
