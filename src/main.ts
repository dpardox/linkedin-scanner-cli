import { WinstonAdapter } from '@adapters/winston.adapter';
import { SoundNotificationAdapter } from '@adapters/sound-notification.adapter';
import { JobCheckerApp } from '@apps/job-checker.app';
import { ChromiumAdapter } from '@adapters/chromium.adapter';
import { FrancAdapter } from '@adapters/franc.adapter';

const logger = new WinstonAdapter();
const notifier = new SoundNotificationAdapter();
const browser = new ChromiumAdapter(logger);
const langDetector = new FrancAdapter();

(async () => {
  const jobChecker = new JobCheckerApp(logger, notifier, browser, langDetector);
  await jobChecker.run();
})();
