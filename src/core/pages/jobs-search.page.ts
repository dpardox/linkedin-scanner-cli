import { type Page, type ElementHandle } from 'playwright';
import { Location } from '@enums/location.enum';
import { Filters } from '@shared/types/filters.type';
import { randms } from '@utils/randms.util';
import { extractEmails } from '@utils/extract-emails.util';
import { JobsViewPage } from './jobs-view.page';
import { SortBy } from '@shared/enums/sort-by.enum';
import { BasePage } from './_base.page';
import { Logger } from '@interfaces/logger.interface';
import { normalize } from '@utils/normalize.util';


export class JobsSearchPage extends BasePage {

  static readonly url: string = 'https://www.linkedin.com/jobs/search';


  constructor(
    page: Page,
    private readonly logger: Logger,
  ) {
    super(page);
  }


  public async open(query: string, location: Location, filters: Filters): Promise<void> {
    this.logger.info('🔍 Opening jobs search page...');

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
  }

  public async noJobsFound(): Promise<boolean> {
    try {
      await this.page.waitForTimeout(randms());
      const locator = await this.page.getByRole('paragraph').filter({ hasText: 'No matching jobs found.' });
      const visible = await locator.isVisible();

      if (visible) {
        this.logger.warn('👀 No matching jobs found.');
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error('⚠️ Error checking for no jobs found: %s', error);
      await this.page.pause();
      process.exit(1);

    }
  }

  public async getJobs(): Promise<string[]> {
    try {
      this.logger.info('🔍 Retrieving job listings...');

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

      this.logger.info(`📋 Found %s job(s).`, ids.length);
      return ids;
    } catch (error) {
      this.logger.error('⚠️ Error getting jobs: %s', error);
      await this.page.pause();
      return [];
    }
  }

  public async nextPage(): Promise<boolean> {
    this.logger.info('🔍 Retrieving pagination...');

    const selector = '.artdeco-pagination__indicator--number.active';

    const el = await this.page.$(selector);

    if (!el) {
      this.logger.warn('No pagination found.');
      return false;
    }

    let currentPage = await el.evaluate((el: HTMLElement) => el.getAttribute('data-test-pagination-page-btn'));

    if (!currentPage) {
      this.logger.error('⚠️ No pagination found.');
      return false;
    }

    const nextPage = await this.page.$(`.artdeco-pagination__indicator--number[data-test-pagination-page-btn="${+currentPage + 1}"]`);

    if (!nextPage) {
      this.logger.warn('End of pagination.');
      return false;
    }

    this.logger.info('🔍 Going to page %s...', +currentPage + 1);
    this.click(nextPage);
    return true;
  }

  private async getJobTitle(job: string): Promise<string | null> {
    try {
      const selector = `.job-card-container[data-job-id="${job}"] .visually-hidden`;
      return await this.page.$eval(selector, (el) => el.textContent);
      // if (card) {
      //   let el = await job.$('.artdeco-entity-lockup__title strong');
      //   el ||= await job.$('.artdeco-entity-lockup__title');
      //   return await el?.evaluate((el: HTMLElement) => el.innerText?.trim()) ?? '';
      // }

      // await this.page.waitForSelector('.job-details-jobs-unified-top-card__job-title');
      // return (await this.page.$eval('.job-details-jobs-unified-top-card__job-title', (el: HTMLElement) => el.innerText.trim()));
    } catch (error) {
      this.logger.error('⚠️ Error getting job title: %s', error);
      await this.page.pause();
      process.exit(1);
    }
  }

  public async isDissmissedJob(job: string): Promise<boolean> {
    try {
      const selector = `.job-card-container[data-job-id="${job}"].job-card-list--is-dismissed`;
      const dismissed = await this.page.$(selector);

      if (dismissed) {
        dismissed.scrollIntoViewIfNeeded();
        this.logger.warn(`🚫 Already dissmissed job "%s"`, await this.getJobTitle(job));
        await this.setBackgroundColor(job, 'rgba(140, 140, 140, .2)');
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error('⚠️ Error checking for dismissed job: %s', error);
      await this.page.pause();
      process.exit(1);
    }
  }

  public async isAppliedJob(job: string): Promise<boolean> {
    try {
      await this.page.waitForTimeout(randms());
      const selector = `.job-card-container[data-job-id="${job}"] .job-card-container__footer-job-state`;
      let el = await this.page.$(selector);

      if (!el) return false;

      const text = await el.evaluate(el => el.textContent ?? '');
      const applied = normalize(text);

      if (applied?.includes('applied')) {
        this.logger.warn(`🚀 You already applied to job "%s".`, await this.getJobTitle(job));
        await this.dissmissJob(job);
        return true;
      };

      return false;
    } catch (error) {
      this.logger.error('⚠️ Error checking for applied job: %s', error);
      await this.page.pause();
      process.exit(1);
    }
  }

  public async isEmptyJob(job: string): Promise<boolean> {
    try {
      await this.page.waitForTimeout(randms());
      const selector = `.scaffold-layout__list-item[data-occludable-job-id="${job}"]`;
      let text = await this.page.$eval(selector, (el) => el.textContent);
      text &&= normalize(text);

      if (!text) {
        this.logger.error('Empty job listing found.');
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error('⚠️ Error checking for empty job: %s', error);
      await this.page.pause();
      process.exit(1);
    }
  }

  private async alreadySelected(job: string, wait = true): Promise<boolean> {
    try {
      const selector = `.job-details-jobs-unified-top-card__job-title a[href*="/jobs/view/${job}"]`;
      wait && await this.page.waitForSelector(selector);
      const el = await this.page.$(selector);
      return !!el;
    } catch (error) {
      this.logger.error('⚠️ Error checking for already selected job: %s', error);
      await this.page.pause();
      process.exit(1);
    }
  }

  public async selectJob(job: string): Promise<void> {
    try {
      this.logger.info('🔍 Selecting job "%s"...', job);

      await this.page.waitForTimeout(randms());

      if (await this.alreadySelected(job, false)) {
        this.logger.warn('⚠️ Already selected job "%s".', job);
        return;
      }

      const selector = `.job-card-container[data-job-id="${job}"]`;
      await this.page.waitForSelector(selector);
      const item = await this.page.$(selector);

      if (!item) {
        this.logger.error('⚠️ Job card not found.');
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

      this.logger.info(`📋 Selected job "%s"`, await this.getJobTitle(job));
      await this.setBackgroundColor(job, 'lightyellow');

      await this.alreadySelected(job);
    } catch (error) {
      this.logger.error('⚠️ Error selecting job: %s', error);
      await this.page.pause();
      process.exit(1);
    }
  }

  public async getJobDetails(job: string) { // TODO (dpardo): return only raw data
    try {
      this.logger.info('🔍 Retrieving job details...');

      await this.page.waitForTimeout(randms());

      const selector = {
        title: '.job-details-jobs-unified-top-card__job-title',
        country: '.job-details-jobs-unified-top-card__tertiary-description-container .tvm__text',
        content: '.jobs-description__container .jobs-box__html-content div',
      };

      await this.page.waitForSelector(selector.title);
      await this.page.waitForSelector(selector.country, { state: 'attached' });
      await this.page.waitForSelector(selector.content);

      await this.page.waitForTimeout(randms());

      const link = `${JobsViewPage.url}/${job}/`;

      const raw = {
        title: await this.innerText(selector.title),
        country: await this.innerText(selector.country),
        content: await this.innerText(selector.content),
      };

      const title = normalize(raw.title ?? '');
      const country = normalize(raw.country ?? '');
      const content = normalize(raw.content ?? '');

      const description = `${title} ${content}`;

      const emails = extractEmails(description);

      const highSkillsMatch = await this.page.getByText('High skills match', { exact: true }).isVisible().catch(() => false);

      const isClosed = await this.page.getByText('No longer accepting applications', { exact: true }).isVisible().catch(() => false);

      return { id: job, link, title, country, content, description, emails, highSkillsMatch, isClosed, raw };
    } catch (error) {
      this.logger.error('⚠️ Error getting job details: %s', error);
      await this.page.pause();
      process.exit(1);
    }
  }

  public async dissmissJob(job: string): Promise<void> {
    try {
      await this.page.waitForTimeout(randms());
      this.logger.warn(`🚫 Dismissing job "%s"...`, await this.getJobTitle(job));
      const selector = `.job-card-container[data-job-id="${job}"] .job-card-container__action`;
      await this.page.waitForSelector(selector);
      const button = await this.page.$(selector);

      if (!button) {
        this.logger.error('⚠️ Dismiss button not found.');
        return;
      }

      await button.waitForElementState('visible');
      await button.waitForElementState('stable');
      await button.click();
      await this.setBackgroundColor(job, 'rgba(140, 140, 140, .2)');
    } catch (error) {
      this.logger.error('⚠️ Error dismissing job: %s', error);
      await this.page.pause();
      process.exit(1);
    }
  }

  public async waitForJobToBeDismissed(job: string) {
    try {
      const title = await this.getJobTitle(job);
      this.logger.warn(`Waiting for "%s"...`, title);
      await this.setBackgroundColor(job, '#daebd1');
      const selector = `.job-card-container[data-job-id="${job}"].job-card-list--is-dismissed`;
      await this.page.waitForSelector(selector, { timeout: 0 });
      await this.setBackgroundColor(job, 'rgba(140, 140, 140, .2)');
      this.logger.info(`▶︎ "%s" dismissed!`, title);
    } catch (error) {
      this.logger.error('Error waiting for job to be dismissed: %s', error);
      await this.page.pause();
      process.exit(1);
    }
  }

  public async setBackgroundColor(job: string, color: string) {
    const selector = `.job-card-container[data-job-id="${job}"]`;
    await this.page.$eval(selector, (el: HTMLElement, color) => {
      el.setAttribute('style', `background-color: ${color};`);
    }, color);
  }

}


// TODO (dpardo): test this class


// TODO (dpardo): create scraper plugin method to recreate a human-like scroll

// await page.mouse.move(100, 200);
// await page.waitForTimeout(300);
// await page.mouse.wheel({ deltaY: 200 });
