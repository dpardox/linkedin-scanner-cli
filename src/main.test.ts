import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const scannerPreferences = {
    searchQueries: ['angular'],
    strictSearchMode: false,
    locationKeys: ['colombia'],
    languages: ['spa'],
    restrictedLocations: [],
    filters: {
      workType: '2',
      easyApply: true,
    },
    includeRuleIds: ['angular'],
    excludeRuleIds: ['english'],
    includeKeywords: [],
    excludeKeywords: [],
    contentSearchQuery: '"desarrollador angular"',
    showUnknownJobs: true,
  };
  const scannerConfig = {
    defaultJobSearchFilters: {},
    jobSearchConfigs: [],
    contentSearchQuery: scannerPreferences.contentSearchQuery,
  };

  return {
    run: vi.fn().mockResolvedValue(undefined),
    closeRuntime: vi.fn(),
    writePreferences: vi.fn(),
    createScannerConfig: vi.fn(() => scannerConfig),
    readPreferences: vi.fn(() => scannerPreferences),
    runAction: vi.fn(async (_labels, action) => await action()),
    selectScannerPreferences: vi.fn().mockResolvedValue(scannerPreferences),
    selectExecutionOptions: vi.fn().mockResolvedValue({
      showUnknownJobs: scannerPreferences.showUnknownJobs,
    }),
    scannerConfig,
    scannerPreferences,
  };
});

vi.mock('@apps/factories/job-checker.factory', () => ({
  createJobCheckerRuntime: vi.fn(() => ({
    jobChecker: {
      run: mocks.run,
    },
    interaction: {
      selectScannerPreferences: mocks.selectScannerPreferences,
      selectExecutionOptions: mocks.selectExecutionOptions,
      runAction: mocks.runAction,
    },
    close: mocks.closeRuntime,
  })),
}));

vi.mock('@config/main.config', () => ({
  createScannerConfig: mocks.createScannerConfig,
}));

vi.mock('@config/scanner-preferences-file.repository', () => ({
  ScannerPreferencesFileRepository: vi.fn(() => ({
    read: mocks.readPreferences,
    write: mocks.writePreferences,
  })),
}));

describe('Main', () => {

  beforeEach(() => {
    vi.resetModules();
    mocks.run.mockClear();
    mocks.closeRuntime.mockClear();
    mocks.writePreferences.mockClear();
    mocks.createScannerConfig.mockClear();
    mocks.readPreferences.mockClear();
    mocks.runAction.mockClear();
    mocks.selectScannerPreferences.mockClear();
    mocks.selectExecutionOptions.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should initialize the application with saved scanner preferences', async () => {
    await import('./main');

    expect(mocks.selectScannerPreferences).toHaveBeenCalledWith(mocks.scannerPreferences);
    expect(mocks.runAction).toHaveBeenCalledWith({
      runningText: 'Saving scanner configuration',
      successText: 'Saved scanner configuration',
      failureText: 'Failed to save scanner configuration',
    }, expect.any(Function));
    expect(mocks.writePreferences).toHaveBeenCalledWith(mocks.scannerPreferences);
    expect(mocks.createScannerConfig).toHaveBeenCalledWith(mocks.scannerPreferences);
    expect(mocks.selectExecutionOptions).toHaveBeenCalledWith({ showUnknownJobs: true });
    expect(mocks.run).toHaveBeenCalledWith(mocks.scannerConfig, { showUnknownJobs: true });
    expect(mocks.closeRuntime).toHaveBeenCalledOnce();
  });

});
