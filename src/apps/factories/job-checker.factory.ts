import { JobCheckerApp } from '@apps/job-checker.app';
import { ChromiumAdapter } from '@adapters/chromium.adapter';
import { NullInteractionAdapter } from '@adapters/null-interaction.adapter';
import { SoundNotificationAdapter } from '@adapters/sound-notification.adapter';
import { WinstonAdapter } from '@adapters/winston.adapter';
import { FrancAdapter } from '@adapters/franc.adapter';
import { PersistedJobRuleManager } from '@config/rules';
import { JobDatasource } from '@infrastructure/datasource/job.datasource';
import { BrowserPort } from '@ports/browser.port';
import { InteractionPort } from '@ports/interaction.port';
import { LoggerPort } from '@ports/logger.port';
import { NotifierPort } from '@ports/notifier.port';
import { LangDetectorPort } from '@ports/lang-detector.port';
import { JobRepository } from '@repository/job.repository';

export type JobCheckerAppDependencies = {
  logger: LoggerPort;
  interaction: InteractionPort;
  notifier: NotifierPort;
  browser: BrowserPort;
  langDetector: LangDetectorPort;
  jobRepository: JobRepository;
};

export type JobCheckerAppOverrides = Partial<JobCheckerAppDependencies>;

function resolveDependencies(overrides: JobCheckerAppOverrides = {}): JobCheckerAppDependencies {
  const persistedJobRuleManager = new PersistedJobRuleManager();
  const sharedTerminalAdapter = !overrides.logger && !overrides.interaction
    ? new WinstonAdapter({ ruleManager: persistedJobRuleManager })
    : undefined;

  const logger = overrides.logger ?? sharedTerminalAdapter ?? new WinstonAdapter({ ruleManager: persistedJobRuleManager });
  const interaction = overrides.interaction ?? sharedTerminalAdapter ?? new NullInteractionAdapter();
  const jobRepository = overrides.jobRepository ?? new JobDatasource();
  const browser = overrides.browser ?? new ChromiumAdapter(logger);
  const notifier = overrides.notifier ?? new SoundNotificationAdapter();
  const langDetector = overrides.langDetector ?? new FrancAdapter();

  return {
    logger,
    interaction,
    notifier,
    browser,
    langDetector,
    jobRepository,
  };
}

export function createJobCheckerRuntime(overrides: JobCheckerAppOverrides = {}): {
  jobChecker: JobCheckerApp;
  interaction: InteractionPort;
} {
  const dependencies = resolveDependencies(overrides);

  const jobChecker = new JobCheckerApp(
    dependencies.logger,
    dependencies.interaction,
    dependencies.notifier,
    dependencies.browser,
    dependencies.langDetector,
    dependencies.jobRepository,
  );

  return {
    jobChecker,
    interaction: dependencies.interaction,
  };
}

export function createJobCheckerApp(overrides: JobCheckerAppOverrides = {}): JobCheckerApp {
  return createJobCheckerRuntime(overrides).jobChecker;
}
