import { createJobCheckerRuntime } from '@apps/factories/job-checker.factory';
import { createScannerConfig } from '@config/main.config';
import { ScannerPreferencesFileRepository } from '@config/scanner-preferences-file.repository';
import { ExecutionOptions } from '@shared/types/execution-options.type';

const defaultExecutionOptions: ExecutionOptions = {
  showUnknownJobs: false,
};

void (async function bootstrap(): Promise<void> {
  const { jobChecker, interaction } = createJobCheckerRuntime();
  const scannerPreferencesRepository = new ScannerPreferencesFileRepository();
  const selectedScannerPreferences = await interaction.selectScannerPreferences(scannerPreferencesRepository.read());
  scannerPreferencesRepository.write(selectedScannerPreferences);

  const scannerConfig = createScannerConfig(selectedScannerPreferences);
  const executionOptions = await interaction.selectExecutionOptions({
    ...defaultExecutionOptions,
    showUnknownJobs: selectedScannerPreferences.showUnknownJobs,
  });

  await jobChecker.run(scannerConfig, executionOptions);
})();
