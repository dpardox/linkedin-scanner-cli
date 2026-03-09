import { afterEach, describe, expect, test, vi } from 'vitest';
import { JobsSearchPage } from './jobs-search.page';
import { BrowserLocatorPort } from '@ports/browser-locator.port';
import { BrowserPagePort } from '@ports/browser-page.port';
import { LoggerPort } from '@ports/logger.port';
import { JobDetailsExtractionError } from './job-details-extraction.error';

describe('JobsSearchPage', () => {

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should read job details using fallback selectors', async () => {
    const locator: BrowserLocatorPort = {
      filter: vi.fn().mockReturnThis(),
      isVisible: vi.fn().mockResolvedValue(false),
    };

    const createElement = (text: string) => ({
      waitForElementState: vi.fn(),
      scrollIntoViewIfNeeded: vi.fn(),
      hover: vi.fn(),
      getAttribute: vi.fn(),
      innerText: vi.fn().mockResolvedValue(text),
      click: vi.fn(),
      evaluate: vi.fn(),
    });

    const pageSelectors = new Map<string, ReturnType<typeof createElement>>([
      ['.jobs-unified-top-card__job-title', createElement('Full Stack Engineer (Angular/Java)')],
      ['.job-details-jobs-unified-top-card__primary-description-container', createElement('Colombia')],
      ['.jobs-description-content__text', createElement('Senior Angular and Java role')],
    ]);

    const selectElement = vi.fn().mockImplementation(async (selector: string) => pageSelectors.get(selector) ?? null);

    const page = {
      goto: vi.fn(),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn(),
      $eval: vi.fn(),
      waitForSelector: vi.fn(),
      $: selectElement,
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
    expect(selectElement).toHaveBeenCalledWith('.job-details-jobs-unified-top-card__job-title');
    expect(selectElement).toHaveBeenCalledWith('.jobs-unified-top-card__job-title');
    expect(selectElement).toHaveBeenCalledWith('.jobs-description-content__text');
  });

  test('should throw a selector extraction error when required fields stay missing', async () => {
    const page = {
      goto: vi.fn(),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn(),
      $eval: vi.fn(),
      waitForSelector: vi.fn(),
      $: vi.fn(),
      $$: vi.fn(),
      getByRole: vi.fn(),
      getByText: vi.fn(),
      url: vi.fn().mockReturnValue('https://www.linkedin.com/jobs/search/?currentJobId=4377411406'),
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

    vi.spyOn(jobsSearchPage as any, 'readJobDetails').mockResolvedValue({
      url: 'https://www.linkedin.com/jobs/search/?currentJobId=4377411406',
      fields: {
        title: { value: '', selector: null },
        location: {
          value: 'Colombia',
          selector: '.job-details-jobs-unified-top-card__primary-description-container',
        },
        description: { value: '', selector: null },
      },
    });

    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(31_000);

    let thrownError: unknown;

    try {
      await (jobsSearchPage as any).waitForJobDetails('4377411406');
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(JobDetailsExtractionError);
    expect((thrownError as Error).message).toContain('Missing required fields: title, description');
  });

});
