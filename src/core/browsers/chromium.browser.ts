import { BrowserContext, chromium, Page, Cookie } from 'playwright';
import 'dotenv/config';
import { Logger } from '@interfaces/logger.interface';


export class ChromiumBrowser {

  private browser!: BrowserContext;


  constructor(
    private readonly logger: Logger,
  ) { }


  public async lunch(): Promise<void> {
    this.logger.info('🌐 Launching browser...');

    const browser = await chromium.launch(
      {
        headless: false,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-infobars',
          '--mute-audio',
          '--disable-notifications',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--lang=en-US',
          '--no-default-browser-check',
          '--no-first-run',
          '--disable-popup-blocking',
          '--disable-extensions',
          '--proxy-bypass-list=*',
          '--disable-session-crashed-bubble',
          '--ignore-certificate-errors',
        ],
      }
    );

    this.logger.info('🌐 Launching browser context...');
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 600 },
      deviceScaleFactor: 2,
      isMobile: false,
      hasTouch: false,
    });

    this.logger.info('🌐 Adding LinkedIn Cookie...');
    const cookie: Cookie = {
      name: 'li_at',
      value: process.env.LINKEDIN_COOKIE || '',
      domain: '.linkedin.com',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    };

    await context.addCookies([cookie]);

    this.logger.info('🌐 Browser ready to use!');
    this.browser = context;
  }

  public async close(): Promise<void> {
    this.logger.info('🌐 Closing browser...');
    await this.browser.close();
  }

  public async firstPage(): Promise<Page> {
    let page = await this.browser.pages().at(0);
    page ||= await this.browser.newPage();
    return page;
  }

  public async newPage(): Promise<Page> {
    return await this.browser.newPage();
  }

}


// TODO (dpardo): Browser plugin
// TODO (dpardo): Scraper plugin
// TODO (dpardo): Create a test for this class
