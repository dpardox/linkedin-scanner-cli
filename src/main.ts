import { createJobCheckerRuntime } from '@apps/factories/job-checker.factory';
import { ExecutionOptions } from '@shared/types/execution-options.type';

const defaultExecutionOptions: ExecutionOptions = {
  showUnknownJobs: false,
};

void (async function bootstrap(): Promise<void> {
  const { jobChecker, interaction } = createJobCheckerRuntime();
  const executionOptions = await interaction.selectExecutionOptions(defaultExecutionOptions);

  await jobChecker.run(executionOptions);
})();
