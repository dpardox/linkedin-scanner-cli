import { WinstonPlugin } from '@plugins/winston.plugin';
import { SoundNotificationAdapter } from '@plugins/sound-notification.plugin';
import { JobCheckerApp } from '@apps/job-checker.app';

const notifier = new SoundNotificationAdapter();
const logger = new WinstonPlugin();

(async () => {
  const jobChecker = new JobCheckerApp(notifier, logger);
  await jobChecker.run();
})();

// TODO (dpardo): loop awaiting 5 minutes
