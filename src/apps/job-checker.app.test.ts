import { describe, expect, test, vi } from 'vitest';
import { JobCheckerApp } from './job-checker.app';
import { LoggerPort } from '@ports/logger.port';
import { JobDetailsExtractionError } from '@core/pages/job-details-extraction.error';
import { jobDetailsFieldSelectors } from '@core/pages/job-details.selectors';

describe('JobCheckerApp', () => {

  test('should continue processing jobs after a single job failure', async () => {
    const logger: LoggerPort = {
      info: vi.fn(),
      warn: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
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

    await (app as any).jobSearch({
      query: 'angular',
      location: '92000000',
      filters: {},
    });

    expect(checkJob).toHaveBeenCalledTimes(2);
    expect(jobsSearchPage.recoverSearchResults).toHaveBeenCalledTimes(1);
    expect(jobsSearchPage.markJobAsSeen).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith('Unable to process job "%s": %s', '4377411406', 'boom');
  });

  test('should stop processing jobs when job detail selectors fail', async () => {
    const logger: LoggerPort = {
      info: vi.fn(),
      warn: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
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

    await expect((app as any).jobSearch({
      query: 'angular',
      location: '92000000',
      filters: {},
    })).rejects.toBe(selectorError);

    expect(jobsSearchPage.recoverSearchResults).not.toHaveBeenCalled();
    expect(jobsSearchPage.markJobAsSeen).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
  });

});
