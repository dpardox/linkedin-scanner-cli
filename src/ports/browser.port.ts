import { BrowserPagePort } from './browser-page.port';

export interface BrowserPort {
  launch(config: { headless?: boolean }): Promise<void>;
  saveSessionState(): Promise<void>;
  clearCookies(): Promise<void>;
  close(): Promise<void>;
  isClosed(): boolean;
  firstPage(): Promise<BrowserPagePort>;
  lastPage(): Promise<BrowserPagePort>;
  newPage(): Promise<BrowserPagePort>;
}
