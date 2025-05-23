import { type Page } from 'playwright';
import { Location } from '@enums/location.enum';
import { Filters } from '@shared/types/filters.type';
import { randms } from '@utils/randms.util';
import { SortBy } from '@shared/enums/sort-by.enum';
import { BasePage } from './_base.page';
import { LoggerPort } from '@ports/logger.port';
import { normalize } from '@utils/normalize.util';
import { JobModel } from '@models/job.model';


export class JobsSearchPage extends BasePage { // TODO (dpardo): pages should be an adapter?

  static readonly url: string = 'https://www.linkedin.com/jobs/search';


  constructor(
    page: Page,
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

    await this.page.evaluate((selector) => {
      const el = document.querySelector(selector);
      if (el) {
        el.scrollTop = 0;
      }
    }, scroll);

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

    const selector = {
      title: '.job-details-jobs-unified-top-card__job-title',
      location: '.job-details-jobs-unified-top-card__tertiary-description-container .tvm__text',
      description: '.jobs-description__container .jobs-box__html-content div',
    };

    await this.page.waitForSelector(selector.title);
    await this.page.waitForSelector(selector.location, { state: 'attached' });
    await this.page.waitForSelector(selector.description);

    await this.page.waitForTimeout(randms());

    const jobModel = new JobModel();
    jobModel.id = jobId;
    jobModel.title = await this.innerText(selector.title);
    jobModel.location = await this.innerText(selector.location);
    jobModel.description = await this.innerText(selector.description);
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
    const title = await this.getJobTitle(job);
    this.logger.warn(`Waiting for "%s"...`, title);
    const selector = `.job-card-container[data-job-id="${job}"].job-card-list--is-dismissed`;
    await this.page.waitForSelector(selector, { timeout: 0 });
    this.logger.success(`Job "%s" dismissed!`, title);
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
    await this.page.$eval(selector, (el: HTMLElement, color) => {
      el.setAttribute('style', `background-color: ${color};`);
    }, color);
  }

}
