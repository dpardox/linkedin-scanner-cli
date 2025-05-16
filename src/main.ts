import { WinstonPlugin } from '@plugins/winston.plugin';
import { SoundNotificationAdapter } from '@plugins/sound-notification.plugin';
import { JobCheckerApp } from '@apps/job-checker.app';
import { TextPlugin } from '@plugins/text.plugin';

const notifier = new SoundNotificationAdapter();
const logger = new WinstonPlugin();
const textPlugin = new TextPlugin();

const jobChecker = new JobCheckerApp(notifier, logger, textPlugin);

jobChecker.run().catch((error) => {
  console.error('App initialization failed:', error);
});

// TODO (dpardo): DB for job id and check if already scanned
// TODO (dpardo): Remove commented code
// TODO (dpardo): loop awaiting 5 minutes
// TODO (dpardo): move debuug to a winston logger
// TODO (dpardo): plugin to franc

// TODO (dpardo): mount this project in a docker container
