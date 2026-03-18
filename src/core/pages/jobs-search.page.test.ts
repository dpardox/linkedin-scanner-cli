import { afterEach, describe, expect, test, vi } from 'vitest';
import { JobsSearchPage } from './jobs-search.page';
import { BrowserLocatorPort } from '@ports/browser-locator.port';
import { BrowserPagePort } from '@ports/browser-page.port';
import { LoggerPort } from '@ports/logger.port';

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
      content: vi.fn().mockResolvedValue('<html></html>'),
      screenshot: vi.fn().mockResolvedValue(undefined),
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

  test('should wait for next pagination page before continuing', async () => {
    const createElement = (attributes: Record<string, string> = {}) => ({
      waitForElementState: vi.fn().mockResolvedValue(undefined),
      scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
      hover: vi.fn().mockResolvedValue(undefined),
      getAttribute: vi.fn().mockImplementation(async (name: string) => attributes[name] ?? null),
      innerText: vi.fn(),
      click: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn(),
    });

    const activePage = createElement({ 'data-test-pagination-page-btn': '1' });
    const nextPageButton = createElement({ 'data-test-pagination-page-btn': '2' });

    const page = {
      goto: vi.fn(),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn(),
      $eval: vi.fn(),
      waitForSelector: vi.fn().mockResolvedValue(null),
      $: vi.fn().mockImplementation(async (selector: string) => {
        if (selector === '.artdeco-pagination__indicator--number.active') return activePage;
        if (selector === '.artdeco-pagination__indicator--number[data-test-pagination-page-btn="2"]') return nextPageButton;
        return null;
      }),
      $$: vi.fn(),
      getByRole: vi.fn(),
      getByText: vi.fn(),
      content: vi.fn().mockResolvedValue('<html></html>'),
      screenshot: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValue('https://www.linkedin.com/jobs/search/?start=25'),
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
    await expect(jobsSearchPage.nextPage()).resolves.toBe(true);

    expect(nextPageButton.click).toHaveBeenCalled();
    expect(page.waitForSelector).toHaveBeenCalledWith(
      '.artdeco-pagination__indicator--number.active[data-test-pagination-page-btn="2"]',
      { timeout: 10_000 },
    );
  });

});
