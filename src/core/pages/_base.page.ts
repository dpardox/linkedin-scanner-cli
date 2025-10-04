import { randms } from '@utils/randms.util';
import { BrowserElementPort } from '@ports/browser-element.port';
import { BrowserPagePort } from '@ports/browser-page.port';


export class BasePage {

  constructor(protected page: BrowserPagePort) { }


  protected async scrollToBottom(selector: string): Promise<void> {
    await this.page.evaluate(async (selector: string) => {
      const element = document.querySelector(selector);

      if (!element) return;

      element.scrollTop = element.scrollHeight;
    }, selector);

    await this.page.waitForTimeout(randms());
  }

  protected async innerText(selector: string): Promise<string> {
    return await this.page.$eval(selector, (el: HTMLElement) => el.innerText);
  }

  protected async click(element: BrowserElementPort): Promise<void> {
    await element.waitForElementState('visible');
    await element.waitForElementState('stable');
    await element.scrollIntoViewIfNeeded();
    await element.click();
    await this.page.waitForTimeout(randms());
  }

}
