import { Page } from 'playwright'; // TODO (dpardo): minimize coupling with playwright

export interface BrowserPort {
  launch(config: { headless?: boolean }): Promise<void>;
  close(): Promise<void>;
  isClosed(): boolean;
  firstPage(): Promise<Page>;
  lastPage(): Promise<Page>;
  newPage(): Promise<Page>;
}
