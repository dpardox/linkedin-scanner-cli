import { describe, expect, test, vi } from 'vitest';
import { JobsSearchPage } from './jobs-search.page';
import { BrowserLocatorPort } from '@ports/browser-locator.port';
import { BrowserPagePort } from '@ports/browser-page.port';
import { LoggerPort } from '@ports/logger.port';

describe('JobsSearchPage', () => {

  test('should read job details using fallback selectors', async () => {
    const locator: BrowserLocatorPort = {
      filter: vi.fn().mockReturnThis(),
      isVisible: vi.fn().mockResolvedValue(false),
    };

    const evaluate = vi.fn().mockImplementation(async (_pageFunction, selectors) => {
      expect(selectors.location).toContain('.job-details-jobs-unified-top-card__primary-description-container');
      expect(selectors.description).toContain('.jobs-description-content__text');

      return {
        url: 'https://www.linkedin.com/jobs/search/?currentJobId=4377411406',
        title: 'Full Stack Engineer (Angular/Java)',
        location: 'Colombia',
        description: 'Senior Angular and Java role',
      };
    });

    const page = {
      goto: vi.fn(),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      evaluate,
      $eval: vi.fn(),
      waitForSelector: vi.fn(),
      $: vi.fn(),
      $$: vi.fn(),
      getByRole: vi.fn(),
      getByText: vi.fn().mockReturnValue(locator),
      url: vi.fn().mockReturnValue('https://www.linkedin.com/jobs/search'),
      once: vi.fn(),
      pause: vi.fn(),
    } as unknown as BrowserPagePort;

    const logger: LoggerPort = {
      info: vi.fn(),
      warn: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      br: vi.fn(),
    };

    const jobsSearchPage = new JobsSearchPage(page, logger);
    const job = await jobsSearchPage.getJobDetails('4377411406');

    expect(job).toMatchObject({
      id: '4377411406',
      title: 'Full Stack Engineer (Angular/Java)',
      location: 'Colombia',
      description: 'Senior Angular and Java role',
      highSkillsMatch: false,
      isClosed: false,
    });
    expect(evaluate).toHaveBeenCalledTimes(1);
  });

});
