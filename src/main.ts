import { WinstonAdapter } from '@adapters/winston.adapter';
import { SoundNotificationAdapter } from '@adapters/sound-notification.adapter';
import { JobCheckerApp } from '@apps/job-checker.app';
import { ChromiumAdapter } from '@adapters/chromium.adapter';

const logger = new WinstonAdapter();
const notifier = new SoundNotificationAdapter();
const browser = new ChromiumAdapter(logger);

(async () => {
  const jobChecker = new JobCheckerApp(logger, notifier, browser);
  await jobChecker.run();
})();

// TODO (dpardo): loop awaiting 5 minutes
