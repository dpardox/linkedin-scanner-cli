import { JobCheckerApp } from '@apps/job-checker.app';
import { ChromiumAdapter } from '@adapters/chromium.adapter';
import { SoundNotificationAdapter } from '@adapters/sound-notification.adapter';
import { WinstonAdapter } from '@adapters/winston.adapter';
import { FrancAdapter } from '@adapters/franc.adapter';
import { JobDatasource } from '@infrastructure/datasource/job.datasource';
import { BrowserPort } from '@ports/browser.port';
import { LoggerPort } from '@ports/logger.port';
import { NotifierPort } from '@ports/notifier.port';
import { LangDetectorPort } from '@ports/lang-detector.port';
import { JobRepository } from '@repository/job.repository';

export type JobCheckerAppDependencies = {
  logger: LoggerPort;
  notifier: NotifierPort;
  browser: BrowserPort;
  langDetector: LangDetectorPort;
  jobRepository: JobRepository;
};

export type JobCheckerAppOverrides = Partial<JobCheckerAppDependencies>;

function resolveDependencies(overrides: JobCheckerAppOverrides = {}): JobCheckerAppDependencies {
  const logger = overrides.logger ?? new WinstonAdapter();
  const jobRepository = overrides.jobRepository ?? new JobDatasource();
  const browser = overrides.browser ?? new ChromiumAdapter(logger);
  const notifier = overrides.notifier ?? new SoundNotificationAdapter();
  const langDetector = overrides.langDetector ?? new FrancAdapter();

  return {
    logger,
    notifier,
    browser,
    langDetector,
    jobRepository,
  };
}

export function createJobCheckerApp(overrides: JobCheckerAppOverrides = {}): JobCheckerApp {
  const dependencies = resolveDependencies(overrides);

  return new JobCheckerApp(
    dependencies.logger,
    dependencies.notifier,
    dependencies.browser,
    dependencies.langDetector,
    dependencies.jobRepository,
  );
}

