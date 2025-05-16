import { ElementHandle, Page } from 'playwright';

import { randms } from '../utils/randms.util';



export class BasePage {

  constructor(protected page: Page) { }


  protected async scrollToBottom(selector: string): Promise<void> {
    await this.page.evaluate(async (selector) => {
      const element = document.querySelector(selector);

      if (!element) return;

      element.scrollTop = element.scrollHeight;
    }, selector);

    await this.page.waitForTimeout(randms());
  }

  protected async innerText(selector: string): Promise<string> {
    return await this.page.$eval(selector, (el: HTMLElement) => el.innerText);
  }

  protected async click(element: ElementHandle): Promise<void> {
    await element.waitForElementState('visible');
    await element.waitForElementState('stable');
    await element.scrollIntoViewIfNeeded();
    element.click();
    await this.page.waitForTimeout(randms());
  }

}

// TODO (dpardo): review if this should be in a plugin
// TODO (dpardo): test this class
