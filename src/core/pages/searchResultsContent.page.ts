import { type Page } from 'playwright';
import { LoggerPort } from '@ports/logger.port';


export class SearchResultsContentPage {

  static readonly url: string = 'https://www.linkedin.com/search/results/content';

  constructor(
    private readonly page: Page,
    private readonly logger: LoggerPort,
  ) { }

  public async open(): Promise<void> {
    this.logger.info('🔍 Opening search post...');

    const url = new URL(SearchResultsContentPage.url);

    url.searchParams.append('datePosted', '"past-24h"');
    url.searchParams.append('keywords', '"desarrollador angular"');
    url.searchParams.append('origin', 'FACETED_SEARCH');
    url.searchParams.append('searchId', 'f3f5c8d1-f9bb-4cb2-a4ff-13a00fc34937');
    url.searchParams.append('sid', 'G%3Bc');
    url.searchParams.append('sortBy', '"date_posted"');

    await this.page.goto(url.href, { waitUntil: 'domcontentloaded' }); // TODO (dpardo): move to browser plugin

    this.logger.info('Waiting check posts...');
    await new Promise<void>((resolve) => {
      this.page.once('close', () => {
        this.logger.info('Page manually closed.');
        resolve();
      });
    });
  }

}

// TODO (dpardo): test this class
