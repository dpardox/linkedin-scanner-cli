export type LoggerContext = {
  runMode?: string;
  phase?: string;
  searchQuery?: string;
  location?: string | number;
  jobId?: string;
};

export type JobCounter = 'skipped' | 'found' | 'discarded' | 'undetermined';

export type ForYouEntry = {
  id: string;
  title: string;
  link: string;
  location: string;
  emails: string[];
  language: string;
  criteria: string[];
};

export interface LoggerPort {
  setContext(context: Partial<LoggerContext>): void;
  countJob?(counter: JobCounter): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  success(...args: unknown[]): void;
  error(...args: unknown[]): void;
  forYou(entry: ForYouEntry): void;
  br(): void;
}
