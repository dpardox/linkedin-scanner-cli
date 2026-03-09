import { Location } from '@enums/location.enum';
import { Filters } from '@shared/types/filters.type';
import { randms } from '@utils/randms.util';
import { SortBy } from '@shared/enums/sort-by.enum';
import { BasePage } from './_base.page';
import { LoggerPort } from '@ports/logger.port';
import { normalize } from '@utils/normalize.util';
import { JobModel } from '@models/job.model';
import { BrowserPagePort } from '@ports/browser-page.port';

type JobDetailsSelectors = {
  title: string[];
  location: string[];
  description: string[];
};

type JobDetailsSnapshot = {
  url: string;
  title: string;
  location: string;
  description: string;
};

const jobDetailsSelectors: JobDetailsSelectors = {
  title: [
    '.job-details-jobs-unified-top-card__job-title',
    '.jobs-unified-top-card__job-title',
    'main h1',
  ],
  location: [
    '.job-details-jobs-unified-top-card__tertiary-description-container .tvm__text',
    '.job-details-jobs-unified-top-card__tertiary-description-container',
    '.job-details-jobs-unified-top-card__primary-description-container',
    '.jobs-unified-top-card__primary-description',
  ],
  description: [
    '.jobs-description__container .jobs-box__html-content',
    '.jobs-description-content__text',
    '.jobs-box__html-content',
  ],
};


export class JobsSearchPage extends BasePage {

  static readonly url: string = 'https://www.linkedin.com/jobs/search';

  private currentSearchUrl: string | null = null;


  constructor(
    page: BrowserPagePort,
    private readonly logger: LoggerPort,
  ) {
    super(page);
  }


  public async open(query: string, location: Location, filters: Filters): Promise<void> {
    this.logger.info('Opening jobs search page...');

    const { timePostedRange, workType ,easyApply } = filters;

    const url = new URL(JobsSearchPage.url);

    easyApply && url.searchParams.append('f_AL', easyApply.toString());
    timePostedRange && url.searchParams.append('f_TPR', timePostedRange);
    workType && url.searchParams.append('f_WT', workType);

    location && url.searchParams.append('geoId', `${location}`);
    query && url.searchParams.append('keywords', query);

    url.searchParams.append('origin', 'JOB_SEARCH_PAGE_JOB_FILTER');
    url.searchParams.append('refresh', 'true');
    url.searchParams.append('spellCorrectionEnabled', 'true');
    url.searchParams.append('sortBy', Math.random() < 0.5 ? SortBy.relevant : SortBy.recent);

    await this.page.goto(url.href, { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(randms());

    if (!this.page.url().startsWith(JobsSearchPage.url)) {
      throw new Error('Failed to open jobs search page.');
    }

    this.rememberCurrentSearchUrl();
  }

  public async noJobsFound(): Promise<boolean> {
    await this.page.waitForTimeout(randms());
    const locator = this.page.getByRole('paragraph').filter({ hasText: 'No matching jobs found.' });
    const visible = await locator.isVisible();

    if (visible) {
      this.logger.error('No matching jobs found.');
      return true;
    }

    return false;
  }

  public async getJobIds(): Promise<string[]> {
    this.logger.info('Retrieving job listings...');
    this.rememberCurrentSearchUrl();

    const layout = '.scaffold-layout__list';
    const scroll = `${layout} > div`;
    const list = `${scroll} ul`;
    const item = `${list} .scaffold-layout__list-item`;
    const attr = 'data-occludable-job-id';

    await this.page.waitForTimeout(randms());

    await this.page.waitForSelector(layout);
    await this.page.waitForSelector(scroll);

    await this.page.waitForTimeout(randms());

    await this.scrollToBottom(scroll);

    await this.page.waitForSelector(list);
    await this.page.waitForSelector(item);

    await this.page.waitForTimeout(randms());

    const jobs = await this.page.$$(item);

    const ids: string[] = [];
    for (const job of jobs) {
      await job.waitForElementState('visible');
      await job.waitForElementState('stable');
      await job.scrollIntoViewIfNeeded();
      await job.hover();
      const id = await job.getAttribute(attr);
      id && ids.push(id);
    }

    await this.page.evaluate((selector: string) => {
      const el = document.querySelector(selector);
      if (el) {
        el.scrollTop = 0;
      }
    }, scroll);

    this.rememberCurrentSearchUrl();
    this.logger.info(`Found %s job(s).`, ids.length);
    return ids;
  }

  public async nextPage(): Promise<boolean> {
    this.logger.br();
    this.logger.info('Retrieving pagination...');

    const selector = '.artdeco-pagination__indicator--number.active';

    const el = await this.page.$(selector);

    if (!el) {
      this.logger.warn('No pagination found.');
      return false;
    }

    let currentPage = await el.evaluate((el: HTMLElement) => el.getAttribute('data-test-pagination-page-btn'));

    if (!currentPage) {
      this.logger.error('No pagination found.');
      return false;
    }

    const nextPage = await this.page.$(`.artdeco-pagination__indicator--number[data-test-pagination-page-btn="${+currentPage + 1}"]`);

    if (!nextPage) {
      this.logger.warn('End of pagination.');
      return false;
    }

    this.logger.info('Going to page %s...', +currentPage + 1);
    this.click(nextPage);
    return true;
  }

  private async getJobTitle(jobId: string): Promise<string | null> {
    const selector = `.job-card-container[data-job-id="${jobId}"] .artdeco-entity-lockup__title strong`;
    return await this.page.$eval(selector, (el) => el.textContent);
  }

  public async isDissmissedJob(job: string): Promise<boolean> {
    const selector = `.job-card-container[data-job-id="${job}"].job-card-list--is-dismissed`;
    const dismissed = await this.page.$(selector);

    if (dismissed) {
      dismissed.scrollIntoViewIfNeeded();
      this.logger.warn(`Already dissmissed job "%s"`, await this.getJobTitle(job));
      return true;
    }

    return false;
  }

  public async isAppliedJob(job: string): Promise<boolean> {
    await this.page.waitForTimeout(randms());
    const selector = `.job-card-container[data-job-id="${job}"] .job-card-container__footer-job-state`;
    let el = await this.page.$(selector);

    if (!el) return false;

    const text = await el.evaluate(el => el.textContent ?? '');
    const applied = normalize(text);

    return applied?.includes('applied');
  }

  public async isEmptyJob(job: string): Promise<boolean> {
    await this.page.waitForTimeout(randms());
    const selector = `.scaffold-layout__list-item[data-occludable-job-id="${job}"]`;
    let text = await this.page.$eval(selector, (el) => el.textContent);
    text &&= normalize(text);

    if (!text) {
      this.logger.error('Empty job listing found.');
      return true;
    }

    return false;
  }

  private async alreadySelected(job: string, wait = true): Promise<boolean> {
    const selector = `.job-details-jobs-unified-top-card__job-title a[href*="/jobs/view/${job}"]`;
    wait && await this.page.waitForSelector(selector);
    const el = await this.page.$(selector);
    return !!el;
  }

  public async selectJob(job: string): Promise<void> {
    this.logger.info('Selecting job "%s"...', job);

    await this.page.waitForTimeout(randms());

    if (await this.alreadySelected(job, false)) {
      this.logger.info('Already selected job "%s".', job);
      return;
    }

    const selector = `.job-card-container[data-job-id="${job}"]`;
    await this.page.waitForSelector(selector);
    const item = await this.page.$(selector);

    if (!item) {
      this.logger.error('Job card not found.');
      return;
    }

    await item.waitForElementState('visible');
    await item.waitForElementState('stable');

    await this.page.waitForTimeout(randms());

    await item.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(randms());
    await item.hover();
    await this.page.waitForTimeout(randms());
    await item.click({ force: true });
    await this.page.waitForTimeout(randms());

    this.logger.info(`Selected job "%s"`, await this.getJobTitle(job));

    await this.alreadySelected(job);
  }

  public async getJobDetails(jobId: string): Promise<JobModel> {
    this.logger.info('Retrieving job details...');

    await this.page.waitForTimeout(randms());
    const details = await this.loadJobDetails(jobId);

    await this.page.waitForTimeout(randms());

    const jobModel = new JobModel();
    jobModel.id = jobId;
    jobModel.title = details.title;
    jobModel.location = details.location;
    jobModel.description = details.description;
    jobModel.highSkillsMatch = await this.page.getByText('High skills match', { exact: true }).isVisible().catch(() => false);
    jobModel.isClosed = await this.page.getByText('No longer accepting applications', { exact: true }).isVisible().catch(() => false);

    return jobModel;
  }

  public async dissmissJob(job: string): Promise<void> {
    this.logger.warn(`Dismissing job "%s"...`, await this.getJobTitle(job));
    await this.page.waitForTimeout(randms());
    const selector = `.job-card-container[data-job-id="${job}"] .job-card-container__action`;
    await this.page.waitForSelector(selector);
    const button = await this.page.$(selector);

    if (!button) {
      this.logger.error('Dismiss button not found.');
      return;
    }

    await button.waitForElementState('visible');
    await button.waitForElementState('stable');
    await button.click();
  }

  public async waitForJobToBeDismissed(job: string) {
    const selector = `.job-card-container[data-job-id="${job}"].job-card-list--is-dismissed`;
    await this.page.waitForSelector(selector, { timeout: 0 });
  }

  public async markJobAsCurrent(jobId: string): Promise<void> {
    await this.setBackgroundColor(jobId, '#fdf0de');
  }

  public async markJobAsSeen(jobId: string) {
    await this.setBackgroundColor(jobId, '#f4f2ee');
  }

  public async markJobForReview(jobId: string) {
    await this.setBackgroundColor(jobId, '#daebd1');
  }

  public async setBackgroundColor(job: string, color: string) {
    const selector = `.job-card-container[data-job-id="${job}"]`;
    const element = await this.page.$(selector);

    if (!element) return;

    await this.page.$eval(selector, (el: HTMLElement, color) => {
      el.setAttribute('style', `background-color: ${color};`);
    }, color);
  }

  public async recoverSearchResults(): Promise<void> {
    if (!this.currentSearchUrl) {
      throw new Error('Search URL not available for recovery.');
    }

    this.logger.warn('Recovering jobs search page...');
    await this.page.goto(this.currentSearchUrl, { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(randms());
    this.rememberCurrentSearchUrl();
  }

  private rememberCurrentSearchUrl(): void {
    const currentUrl = this.page.url();
    if (currentUrl.startsWith(JobsSearchPage.url)) {
      this.currentSearchUrl = currentUrl;
    }
  }

  private async loadJobDetails(jobId: string): Promise<JobDetailsSnapshot> {
    try {
      return await this.waitForJobDetails(jobId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn('Retrying job "%s" details after refresh: %s', jobId, message);
      await this.recoverSearchResults();
      await this.selectJob(jobId);
      return await this.waitForJobDetails(jobId);
    }
  }

  private async waitForJobDetails(jobId: string): Promise<JobDetailsSnapshot> {
    const timeout = 30_000;
    const interval = 500;
    const startedAt = Date.now();
    let snapshot = await this.readJobDetails();

    while (Date.now() - startedAt < timeout) {
      if (snapshot.title && snapshot.description) {
        return snapshot;
      }

      await this.page.waitForTimeout(interval);
      snapshot = await this.readJobDetails();
    }

    throw new Error(`Timed out retrieving job details for "${jobId}" at ${snapshot.url}`);
  }

  private async readJobDetails(): Promise<JobDetailsSnapshot> {
    return await this.page.evaluate((selectors: JobDetailsSelectors) => {
      const readFirstText = (candidates: string[]): string => {
        for (const candidate of candidates) {
          const element = document.querySelector<HTMLElement>(candidate);
          const text = element?.innerText?.trim();

          if (text) {
            return text;
          }
        }

        return '';
      };

      return {
        url: window.location.href,
        title: readFirstText(selectors.title),
        location: readFirstText(selectors.location),
        description: readFirstText(selectors.description),
      };
    }, jobDetailsSelectors);
  }

}
