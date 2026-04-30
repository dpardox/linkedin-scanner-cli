import { createJobCheckerRuntime } from '@apps/factories/job-checker.factory';
import { createScannerConfig } from '@config/main.config';
import { ScannerPreferencesFileRepository } from '@config/scanner-preferences-file.repository';
import { ExecutionOptions } from '@shared/types/execution-options.type';

const defaultExecutionOptions: ExecutionOptions = {
  showUnknownJobs: false,
};

void (async function bootstrap(): Promise<void> {
  const { jobChecker, interaction, close } = createJobCheckerRuntime();

  try {
    const scannerPreferencesRepository = new ScannerPreferencesFileRepository();
    const selectedScannerPreferences = await interaction.selectScannerPreferences(scannerPreferencesRepository.read());
    await interaction.runAction({
      runningText: 'Saving scanner configuration',
      successText: 'Saved scanner configuration',
      failureText: 'Failed to save scanner configuration',
    }, () => {
      scannerPreferencesRepository.write(selectedScannerPreferences);
    });

    const scannerConfig = createScannerConfig(selectedScannerPreferences);
    const executionOptions = await interaction.selectExecutionOptions({
      ...defaultExecutionOptions,
      showUnknownJobs: selectedScannerPreferences.showUnknownJobs,
    });

    await jobChecker.run(scannerConfig, executionOptions);
  } finally {
    close();
  }
})();
