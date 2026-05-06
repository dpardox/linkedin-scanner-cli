import { describe, expect, test, vi } from 'vitest';
import { JobCheckerApp } from './job-checker.app';
import { LoggerPort } from '@ports/logger.port';
import { JobDetailsExtractionError } from '@core/pages/job-details-extraction.error';
import { jobDetailsFieldSelectors } from '@core/pages/job-details.selectors';
import { defaultJobSearchFilters } from '@config/main.config';
import { TimePostedRange } from '@enums/time-posted-range.enum';
import { JobStatus } from '@enums/job-status.enum';
import { WorkType } from '@enums/work-type.enum';
import { JobModel } from '@models/job.model';

const executionOptions = {
  showUnknownJobs: false,
};

function createLogger(): LoggerPort {
  return {
    setContext: vi.fn(),
    countJob: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    forYou: vi.fn(),
    br: vi.fn(),
    trackUndetermined: vi.fn(),
  };
}

function createInteraction() {
  return {
    selectExecutionOptions: vi.fn(),
    runAction: vi.fn(async (_labels, action) => await action()),
    startManualReview: vi.fn(),
    finishManualReview: vi.fn(),
  };
}

describe('JobCheckerApp', () => {

  test('should not define a manual time posted range in default filters', () => {
    expect(defaultJobSearchFilters.timePostedRange).toBeUndefined();
  });

  test('should merge default job search filters into expanded configs', () => {
    const logger = createLogger();

    const app = new JobCheckerApp(
      logger,
      createInteraction() as any,
      { notify: vi.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const expandedConfigs = (app as any).expandConfigs([
      {
        query: 'angular',
        locations: [ '92000000' as any ],
        filters: {
          easyApply: true,
        },
        keywords: {
          include: [],
          exclude: [],
        },
        languages: [ 'spa' ],
      },
    ]);

    expect(expandedConfigs).toHaveLength(1);
    expect(expandedConfigs[0].filters).toEqual({
      easyApply: true,
    });
  });

  test('should ignore configured time posted ranges and keep the remaining filters', () => {
    const logger = createLogger();

    const app = new JobCheckerApp(
      logger,
      createInteraction() as any,
      { notify: vi.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const expandedConfigs = (app as any).expandConfigs([
      {
        query: 'angular',
        locations: [ '92000000' as any ],
        filters: {
          timePostedRange: TimePostedRange.week,
          workType: WorkType.remote,
        },
        keywords: {
          include: [],
          exclude: [],
        },
        languages: [ 'spa' ],
      },
    ]);

    expect(expandedConfigs).toHaveLength(1);
    expect(expandedConfigs[0].filters).toEqual({
      workType: WorkType.remote,
    });
  });

  test('should search all configs by day, then week and finally month', async () => {
    const logger = createLogger();

    const app = new JobCheckerApp(
      logger,
      createInteraction() as any,
      { notify: vi.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const jobsSearchPage = {
      open: vi.fn().mockResolvedValue(undefined),
      nextPage: vi.fn().mockResolvedValue(false),
    };

    (app as any).jobsSearchPage = jobsSearchPage;
    vi.spyOn(app as any, 'noJobsFound').mockResolvedValue(true);
    const waitBeforeNextSearchAfterNoJobsFound = vi
      .spyOn(app as any, 'waitBeforeNextSearchAfterNoJobsFound')
      .mockResolvedValue(undefined);

    await (app as any).runJobSearches([
      {
        query: 'angular',
        location: '92000000',
        filters: {
          easyApply: true,
          workType: WorkType.remote,
        },
      },
      {
        query: 'react',
        location: '103644278',
        filters: {
          easyApply: false,
          workType: WorkType.hybrid,
        },
      },
    ], executionOptions);

    expect(jobsSearchPage.open).toHaveBeenNthCalledWith(1, 'angular', '92000000', {
      easyApply: true,
      workType: WorkType.remote,
      timePostedRange: TimePostedRange.day,
    });
    expect(jobsSearchPage.open).toHaveBeenNthCalledWith(2, 'react', '103644278', {
      easyApply: false,
      workType: WorkType.hybrid,
      timePostedRange: TimePostedRange.day,
    });
    expect(jobsSearchPage.open).toHaveBeenNthCalledWith(3, 'angular', '92000000', {
      easyApply: true,
      workType: WorkType.remote,
      timePostedRange: TimePostedRange.week,
    });
    expect(jobsSearchPage.open).toHaveBeenNthCalledWith(4, 'react', '103644278', {
      easyApply: false,
      workType: WorkType.hybrid,
      timePostedRange: TimePostedRange.week,
    });
    expect(jobsSearchPage.open).toHaveBeenNthCalledWith(5, 'angular', '92000000', {
      easyApply: true,
      workType: WorkType.remote,
      timePostedRange: TimePostedRange.month,
    });
    expect(jobsSearchPage.open).toHaveBeenNthCalledWith(6, 'react', '103644278', {
      easyApply: false,
      workType: WorkType.hybrid,
      timePostedRange: TimePostedRange.month,
    });
    expect(waitBeforeNextSearchAfterNoJobsFound).toHaveBeenCalledTimes(6);
  });

  test('should wait before moving to the next search when no jobs are found', async () => {
    const logger = createLogger();

    const app = new JobCheckerApp(
      logger,
      createInteraction() as any,
      { notify: vi.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const jobsSearchPage = {
      open: vi.fn().mockResolvedValue(undefined),
      nextPage: vi.fn().mockResolvedValue(false),
    };

    (app as any).jobsSearchPage = jobsSearchPage;
    vi.spyOn(app as any, 'noJobsFound').mockResolvedValue(true);
    const waitBeforeNextSearchAfterNoJobsFound = vi
      .spyOn(app as any, 'waitBeforeNextSearchAfterNoJobsFound')
      .mockResolvedValue(undefined);

    await (app as any).jobSearchByTimePostedRange({
      query: 'angular',
      location: '92000000',
      filters: {},
    }, TimePostedRange.day, executionOptions);

    expect(waitBeforeNextSearchAfterNoJobsFound).toHaveBeenCalledTimes(1);
    expect(jobsSearchPage.nextPage).not.toHaveBeenCalled();
  });

  test('should not count skipped jobs as counter entries', async () => {
    const logger = createLogger();
    const jobRepository = {
      findById: vi.fn(async (jobId: string) => {
        if (jobId === 'processed') {
          return new JobModel({
            id: jobId,
            status: JobStatus.dissmissed,
          });
        }

        return null;
      }),
    };

    const app = new JobCheckerApp(
      logger,
      createInteraction() as any,
      { notify: vi.fn() } as any,
      {} as any,
      {} as any,
      jobRepository as any,
    );

    const jobsSearchPage = {
      getJobIds: vi.fn().mockResolvedValue(['processed', 'empty', 'new']),
      isEmptyJob: vi.fn(async (jobId: string) => jobId === 'empty'),
      markJobAsSeen: vi.fn().mockResolvedValue(undefined),
    };

    (app as any).jobsSearchPage = jobsSearchPage;

    await expect((app as any).getJobIds()).resolves.toEqual(['new']);

    expect(jobsSearchPage.markJobAsSeen).toHaveBeenCalledWith('processed');
    expect(logger.countJob).not.toHaveBeenCalled();
  });

  test('should continue processing jobs after a single job failure', async () => {
    const logger = createLogger();

    const app = new JobCheckerApp(
      logger,
      createInteraction() as any,
      { notify: vi.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const jobsSearchPage = {
      open: vi.fn().mockResolvedValue(undefined),
      markJobAsCurrent: vi.fn().mockResolvedValue(undefined),
      markJobAsSeen: vi.fn().mockResolvedValue(undefined),
      nextPage: vi.fn().mockResolvedValue(false),
      recoverSearchResults: vi.fn().mockResolvedValue(undefined),
    };

    (app as any).jobsSearchPage = jobsSearchPage;
    (app as any).loginPage = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      ensureAuthenticated: vi.fn().mockResolvedValue(undefined),
    };

    vi.spyOn(app as any, 'noJobsFound').mockResolvedValue(false);
    vi.spyOn(app as any, 'getJobIds').mockResolvedValue(['4377411406', '4372495081']);
    const checkJob = vi.spyOn(app as any, 'checkJob').mockImplementation(async (jobId: string) => {
      if (jobId === '4377411406') {
        throw new Error('boom');
      }
    });

    await (app as any).jobSearchByTimePostedRange({
      query: 'angular',
      location: '92000000',
      filters: {},
    }, TimePostedRange.day, executionOptions);

    expect(checkJob).toHaveBeenCalledTimes(2);
    expect(jobsSearchPage.recoverSearchResults).toHaveBeenCalledTimes(1);
    expect(jobsSearchPage.markJobAsSeen).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith('Unable to process job "%s": %s', '4377411406', 'boom');
  });

  test('should stop processing jobs when job detail selectors fail', async () => {
    const logger = createLogger();

    const app = new JobCheckerApp(
      logger,
      createInteraction() as any,
      { notify: vi.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const jobsSearchPage = {
      open: vi.fn().mockResolvedValue(undefined),
      markJobAsCurrent: vi.fn().mockResolvedValue(undefined),
      markJobAsSeen: vi.fn().mockResolvedValue(undefined),
      nextPage: vi.fn().mockResolvedValue(false),
      recoverSearchResults: vi.fn().mockResolvedValue(undefined),
    };

    (app as any).jobsSearchPage = jobsSearchPage;
    (app as any).loginPage = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      ensureAuthenticated: vi.fn().mockResolvedValue(undefined),
    };

    vi.spyOn(app as any, 'noJobsFound').mockResolvedValue(false);
    vi.spyOn(app as any, 'getJobIds').mockResolvedValue(['4377411406']);

    const selectorError = new JobDetailsExtractionError(
      '4377411406',
      {
        url: 'https://www.linkedin.com/jobs/search/?currentJobId=4377411406',
        fields: {
          title: { value: '', selector: null },
          location: {
            value: 'Colombia',
            selector: '.job-details-jobs-unified-top-card__primary-description-container',
          },
          description: { value: '', selector: null },
        },
      },
      jobDetailsFieldSelectors,
    );

    vi.spyOn(app as any, 'checkJob').mockRejectedValue(selectorError);

    await expect((app as any).jobSearchByTimePostedRange({
      query: 'angular',
      location: '92000000',
      filters: {},
    }, TimePostedRange.day, executionOptions)).rejects.toBe(selectorError);

    expect(jobsSearchPage.recoverSearchResults).not.toHaveBeenCalled();
    expect(jobsSearchPage.markJobAsSeen).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('should classify jobs with include matches for manual review', async () => {
    const logger = createLogger();

    const app = new JobCheckerApp(
      logger,
      createInteraction() as any,
      { notify: vi.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const evaluation = await (app as any).evaluateJobMatch(new JobModel({
      id: '4386875881',
      title: 'Angular Developer',
      description: 'Angular and TypeScript role',
      location: 'Remote',
      highSkillsMatch: true,
    }), {
      keywords: {
        include: ['Angular', 'React'],
        exclude: [],
      },
    });

    expect(evaluation).toEqual({
      classification: 'include',
      criteria: ['Angular'],
    });
  });

  test('should count include matches as for me counter entries', async () => {
    const logger = createLogger();
    const interaction = createInteraction();

    const app = new JobCheckerApp(
      logger,
      interaction as any,
      { notify: vi.fn() } as any,
      {} as any,
      { detect: vi.fn().mockReturnValue('eng') } as any,
      {} as any,
    );

    vi.spyOn(app as any, 'getJobDetails').mockResolvedValue(new JobModel({
      id: '4386875881',
      title: 'Angular Developer',
      description: 'Angular and TypeScript role',
      location: 'Remote',
    }));
    vi.spyOn(app as any, 'isDissmissedJob').mockResolvedValue(false);
    vi.spyOn(app as any, 'isAppliedJob').mockResolvedValue(false);
    vi.spyOn(app as any, 'hasValidLanguage').mockResolvedValue(true);
    vi.spyOn(app as any, 'markForManualCheck').mockResolvedValue(undefined);

    await (app as any).checkJob('4386875881', {
      keywords: {
        include: ['Angular'],
        exclude: [],
      },
    }, executionOptions);

    expect(logger.countJob).toHaveBeenCalledTimes(1);
    expect(logger.countJob).toHaveBeenCalledWith('forMe', {
      id: '4386875881',
      title: 'Angular Developer',
      reason: 'Matched include keywords: Angular',
      criteria: ['Angular'],
    });
  });

  test('should discard jobs with exclude matches without sending them to unknown review', async () => {
    const logger = createLogger();
    const interaction = createInteraction();
    const jobRepository = {
      update: vi.fn().mockResolvedValue(undefined),
    };

    const app = new JobCheckerApp(
      logger,
      interaction as any,
      { notify: vi.fn() } as any,
      {} as any,
      {} as any,
      jobRepository as any,
    );

    vi.spyOn(app as any, 'getJobDetails').mockResolvedValue(new JobModel({
      id: '4386875881',
      title: 'PHP Backend Developer',
      description: 'We are looking for a PHP developer',
      location: 'Remote',
    }));
    vi.spyOn(app as any, 'isDissmissedJob').mockResolvedValue(false);
    vi.spyOn(app as any, 'isAppliedJob').mockResolvedValue(false);
    vi.spyOn(app as any, 'hasValidLanguage').mockResolvedValue(true);

    const markForManualCheck = vi.spyOn(app as any, 'markForManualCheck').mockResolvedValue(undefined);
    const markUndeterminedJobForManualCheck = vi.spyOn(app as any, 'markUndeterminedJobForManualCheck').mockResolvedValue(undefined);

    await (app as any).checkJob('4386875881', {
      keywords: {
        include: ['Angular'],
        exclude: ['PHP'],
      },
    }, executionOptions);

    expect(jobRepository.update).toHaveBeenCalledWith('4386875881', {
      status: JobStatus.dissmissed,
    });
    expect(markForManualCheck).not.toHaveBeenCalled();
    expect(markUndeterminedJobForManualCheck).not.toHaveBeenCalled();
    expect(logger.countJob).toHaveBeenCalledWith('notApplicable', {
      id: '4386875881',
      title: 'PHP Backend Developer',
      reason: 'Excluded keywords: PHP',
      criteria: ['PHP'],
    });
    expect(logger.error).toHaveBeenCalledWith('Job "%s" has exclude words: %O', 'PHP Backend Developer', ['PHP']);
  });

  test('should keep unknown jobs hidden from manual review when execution option is disabled', async () => {
    const logger = createLogger();
    const interaction = createInteraction();
    const notifier = {
      notify: vi.fn(),
    };
    const jobRepository = {
      update: vi.fn().mockResolvedValue(undefined),
    };

    const app = new JobCheckerApp(
      logger,
      interaction as any,
      notifier as any,
      {} as any,
      {} as any,
      jobRepository as any,
    );

    vi.spyOn(app as any, 'getJobDetails').mockResolvedValue(new JobModel({
      id: '4386875881',
      title: 'TypeScript Developer',
      description: 'We build internal tools',
      location: 'Remote',
    }));
    vi.spyOn(app as any, 'isDissmissedJob').mockResolvedValue(false);
    vi.spyOn(app as any, 'isAppliedJob').mockResolvedValue(false);
    vi.spyOn(app as any, 'hasValidLanguage').mockResolvedValue(true);

    await (app as any).checkJob('4386875881', {
      keywords: {
        include: ['Angular'],
        exclude: ['PHP'],
      },
    }, executionOptions);

    expect(jobRepository.update).toHaveBeenCalledTimes(1);
    expect(jobRepository.update).toHaveBeenCalledWith('4386875881', {
      status: JobStatus.undetermined,
    });
    expect(logger.countJob).toHaveBeenCalledWith('unknown', {
      id: '4386875881',
      title: 'TypeScript Developer',
      reason: 'No include or exclude keywords matched',
      criteria: undefined,
    });
    expect(logger.countJob).not.toHaveBeenCalledWith('forMe', '4386875881');
    expect(logger.forYou).not.toHaveBeenCalled();
    expect(logger.trackUndetermined).not.toHaveBeenCalled();
    expect(interaction.startManualReview).not.toHaveBeenCalled();
    expect(interaction.finishManualReview).not.toHaveBeenCalled();
    expect(notifier.notify).not.toHaveBeenCalled();
  });

  test('should resume the scanner context after manual review finishes', async () => {
    const logger = createLogger();
    const interaction = createInteraction();

    const jobRepository = {
      update: vi.fn().mockResolvedValue(undefined),
    };

    const app = new JobCheckerApp(
      logger,
      interaction as any,
      { notify: vi.fn() } as any,
      {} as any,
      {} as any,
      jobRepository as any,
    );

    (app as any).jobsSearchPage = {
      markJobForReview: vi.fn().mockResolvedValue(undefined),
      waitForJobToBeDismissed: vi.fn().mockResolvedValue(undefined),
    };

    await (app as any).markForManualCheck({
      id: '4386875881',
      title: 'Programador full stack',
    }, {
      id: '4386875881',
      title: 'Programador full stack',
      link: 'https://www.linkedin.com/jobs/view/4386875881/',
      location: 'Remote',
      emails: [],
      language: 'spa',
      criteria: ['Unknown'],
      classification: 'unknown',
      defaultRuleScope: 'exclude',
    });

    expect(logger.setContext).toHaveBeenNthCalledWith(1, {
      runMode: 'manual-review',
      phase: 'Waiting manual review',
      jobId: '4386875881',
      jobTitle: 'Programador full stack',
    });
    expect(logger.setContext).toHaveBeenNthCalledWith(2, {
      runMode: 'default',
      phase: 'Resuming scan',
      jobId: '4386875881',
      jobTitle: 'Programador full stack',
    });
    expect(jobRepository.update).toHaveBeenCalledWith('4386875881', {
      status: JobStatus.dissmissed,
    });
    expect(logger.countJob).toHaveBeenCalledWith('unknown', {
      id: '4386875881',
      title: 'Programador full stack',
      reason: 'No include or exclude keywords matched',
      criteria: undefined,
    });
    expect(interaction.startManualReview).toHaveBeenCalledWith({
      id: '4386875881',
      title: 'Programador full stack',
      link: 'https://www.linkedin.com/jobs/view/4386875881/',
      location: 'Remote',
      emails: [],
      language: 'spa',
      criteria: ['Unknown'],
      classification: 'unknown',
      defaultRuleScope: 'exclude',
    });
    expect(interaction.finishManualReview).toHaveBeenCalledWith('4386875881');
    expect(logger.success).toHaveBeenCalledWith('Job "%s" reviewed!', 'Programador full stack');
  });

  test('should reclassify jobs when manual review uses a newer classification', async () => {
    const logger = createLogger();
    const interaction = createInteraction();

    const jobRepository = {
      update: vi.fn().mockResolvedValue(undefined),
    };

    const app = new JobCheckerApp(
      logger,
      interaction as any,
      { notify: vi.fn() } as any,
      {} as any,
      {} as any,
      jobRepository as any,
    );

    (app as any).jobsSearchPage = {
      markJobForReview: vi.fn().mockResolvedValue(undefined),
      waitForJobToBeDismissed: vi.fn().mockResolvedValue(undefined),
    };

    (app as any).countJob('4386875881', 'notApplicable');

    await (app as any).markForManualCheck({
      id: '4386875881',
      title: 'Angular Developer',
    }, {
      id: '4386875881',
      title: 'Angular Developer',
      link: 'https://www.linkedin.com/jobs/view/4386875881/',
      location: 'Remote',
      emails: [],
      language: 'eng',
      criteria: ['Angular'],
      classification: 'include',
      defaultRuleScope: 'include',
    });

    expect(logger.countJob).toHaveBeenNthCalledWith(1, 'notApplicable', '4386875881');
    expect(logger.countJob).toHaveBeenNthCalledWith(2, 'forMe', {
      id: '4386875881',
      title: 'Angular Developer',
      reason: 'Matched include keywords: Angular',
      criteria: ['Angular'],
    });
  });

  test('should treat undetermined jobs like manual review matches', async () => {
    const logger = createLogger();
    const interaction = createInteraction();

    const jobRepository = {
      update: vi.fn().mockResolvedValue(undefined),
    };

    const notifier = {
      notify: vi.fn(),
    };

    const app = new JobCheckerApp(
      logger,
      interaction as any,
      notifier as any,
      {} as any,
      { detect: vi.fn().mockReturnValue('spa') } as any,
      jobRepository as any,
    );

    (app as any).jobsSearchPage = {
      markJobForReview: vi.fn().mockResolvedValue(undefined),
      waitForJobToBeDismissed: vi.fn().mockResolvedValue(undefined),
    };

    await (app as any).markUndeterminedJobForManualCheck(new JobModel({
      id: '4386875881',
      title: 'Angular Developer',
      location: 'Remote',
      status: JobStatus.undetermined,
    }));

    expect(notifier.notify).toHaveBeenCalledTimes(1);
    expect(jobRepository.update).toHaveBeenCalledTimes(2);
    expect(jobRepository.update).toHaveBeenNthCalledWith(1, '4386875881', {
      status: JobStatus.undetermined,
    });
    expect(jobRepository.update).toHaveBeenNthCalledWith(2, '4386875881', {
      status: JobStatus.dissmissed,
    });
    expect(logger.forYou).toHaveBeenCalledWith({
      id: '4386875881',
      title: 'Angular Developer',
      location: 'Remote',
      link: 'https://www.linkedin.com/jobs/view/4386875881/',
      emails: [],
      language: 'spa',
      criteria: ['Unknown'],
    });
    expect(logger.countJob).toHaveBeenCalledTimes(1);
    expect(logger.countJob).toHaveBeenCalledWith('unknown', {
      id: '4386875881',
      title: 'Angular Developer',
      reason: 'No include or exclude keywords matched',
      criteria: undefined,
    });
    expect(logger.countJob).not.toHaveBeenCalledWith('forMe', '4386875881');
    expect((app as any).jobsSearchPage.markJobForReview).toHaveBeenCalledWith('4386875881');
    expect((app as any).jobsSearchPage.waitForJobToBeDismissed).toHaveBeenCalledWith('4386875881');
    expect(interaction.startManualReview).toHaveBeenCalledWith({
      id: '4386875881',
      title: 'Angular Developer',
      location: 'Remote',
      link: 'https://www.linkedin.com/jobs/view/4386875881/',
      emails: [],
      language: 'spa',
      criteria: ['Unknown'],
      classification: 'unknown',
      defaultRuleScope: 'exclude',
    });
    expect(interaction.finishManualReview).toHaveBeenCalledWith('4386875881');
  });

});
