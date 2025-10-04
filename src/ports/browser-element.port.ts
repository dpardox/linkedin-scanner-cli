export type BrowserElementState = 'visible' | 'hidden' | 'stable' | 'enabled' | 'disabled' | 'editable';

export interface BrowserClickOptions {
  force?: boolean;
}

export interface BrowserElementPort {
  waitForElementState(state: BrowserElementState): Promise<void>;
  scrollIntoViewIfNeeded(): Promise<void>;
  hover(): Promise<void>;
  getAttribute(name: string): Promise<string | null>;
  click(options?: BrowserClickOptions): Promise<void>;
  evaluate<TResult>(pageFunction: (element: HTMLElement) => TResult | Promise<TResult>): Promise<TResult>;
}
