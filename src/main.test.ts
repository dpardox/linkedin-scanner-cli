import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const runMock = vi.fn().mockResolvedValue(undefined);
const defaultExecutionOptions = {
  showUnknownJobs: false,
};
const selectExecutionOptionsMock = vi.fn().mockResolvedValue(defaultExecutionOptions);

vi.mock('@apps/factories/job-checker.factory', () => ({
  createJobCheckerRuntime: vi.fn(() => ({
    jobChecker: {
      run: runMock,
    },
    interaction: {
      selectExecutionOptions: selectExecutionOptionsMock,
    },
  })),
}));

describe('Main', () => {

  beforeEach(() => {
    vi.resetModules();
    runMock.mockClear();
    selectExecutionOptionsMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should initialize the application', async () => {
    await import('./main');

    expect(selectExecutionOptionsMock).toHaveBeenCalledWith(defaultExecutionOptions);
    expect(runMock).toHaveBeenCalledWith(defaultExecutionOptions);
  });

});
