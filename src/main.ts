import { createJobCheckerApp } from '@apps/factories/job-checker.factory';

void (async function bootstrap(): Promise<void> {
  const jobChecker = createJobCheckerApp();
  await jobChecker.run();
})();
