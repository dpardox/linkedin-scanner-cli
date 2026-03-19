import { describe, expect, test, vi } from 'vitest';
import { JobCheckerApp } from './job-checker.app';
import { LoggerPort } from '@ports/logger.port';
import { JobDetailsExtractionError } from '@core/pages/job-details-extraction.error';
import { jobDetailsFieldSelectors } from '@core/pages/job-details.selectors';
import { defaultJobSearchFilters } from '@config/main.config';
import { TimePostedRange } from '@enums/time-posted-range.enum';
import { WorkType } from '@enums/work-type.enum';

describe('JobCheckerApp', () => {

  test('should not define a manual time posted range in default filters', () => {
    expect(defaultJobSearchFilters.timePostedRange).toBeUndefined();
  });

  test('should merge default job search filters into expanded configs', () => {
    const logger: LoggerPort = {
      setContext: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      forYou: vi.fn(),
      br: vi.fn(),
    };

    const app = new JobCheckerApp(
      logger,
      { notify: vi.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const expandedConfigs = (app as any).expandConfigs([
      {
        query: 'angular',
        locations: [ '92000000' as any ],
        restrictedLocations: [],
        filters: {
          easyApply: true,
        },
        keywords: {
          strictInclude: [],
          strictExclude: [],
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
    const logger: LoggerPort = {
      setContext: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      forYou: vi.fn(),
      br: vi.fn(),
    };

    const app = new JobCheckerApp(
      logger,
      { notify: vi.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const expandedConfigs = (app as any).expandConfigs([
      {
        query: 'angular',
        locations: [ '92000000' as any ],
        restrictedLocations: [],
        filters: {
          timePostedRange: TimePostedRange.week,
          workType: WorkType.remote,
        },
        keywords: {
          strictInclude: [],
          strictExclude: [],
        },
        languages: [ 'spa' ],
      },
    ]);

    expect(expandedConfigs).toHaveLength(1);
    expect(expandedConfigs[0].filters).toEqual({
      workType: WorkType.remote,
    });
  });

  test('should search day, week and month in order', async () => {
    const logger: LoggerPort = {
      setContext: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      forYou: vi.fn(),
      br: vi.fn(),
    };

    const app = new JobCheckerApp(
      logger,
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

    await (app as any).jobSearch({
      query: 'angular',
      location: '92000000',
      filters: {
        easyApply: true,
        workType: WorkType.remote,
      },
    });

    expect(jobsSearchPage.open).toHaveBeenNthCalledWith(1, 'angular', '92000000', {
      easyApply: true,
      workType: WorkType.remote,
      timePostedRange: TimePostedRange.day,
    });
    expect(jobsSearchPage.open).toHaveBeenNthCalledWith(2, 'angular', '92000000', {
      easyApply: true,
      workType: WorkType.remote,
      timePostedRange: TimePostedRange.week,
    });
    expect(jobsSearchPage.open).toHaveBeenNthCalledWith(3, 'angular', '92000000', {
      easyApply: true,
      workType: WorkType.remote,
      timePostedRange: TimePostedRange.month,
    });
  });

  test('should continue processing jobs after a single job failure', async () => {
    const logger: LoggerPort = {
      setContext: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      forYou: vi.fn(),
      br: vi.fn(),
    };

    const app = new JobCheckerApp(
      logger,
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
    }, TimePostedRange.day);

    expect(checkJob).toHaveBeenCalledTimes(2);
    expect(jobsSearchPage.recoverSearchResults).toHaveBeenCalledTimes(1);
    expect(jobsSearchPage.markJobAsSeen).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith('Unable to process job "%s": %s', '4377411406', 'boom');
  });

  test('should stop processing jobs when job detail selectors fail', async () => {
    const logger: LoggerPort = {
      setContext: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      forYou: vi.fn(),
      br: vi.fn(),
    };

    const app = new JobCheckerApp(
      logger,
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
    }, TimePostedRange.day)).rejects.toBe(selectorError);

    expect(jobsSearchPage.recoverSearchResults).not.toHaveBeenCalled();
    expect(jobsSearchPage.markJobAsSeen).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
  });

});
