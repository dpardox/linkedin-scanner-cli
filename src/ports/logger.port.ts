import { UndeterminedQueueEntry } from '@shared/types/undetermined-queue-entry.type';

export type LoggerContext = {
  runMode?: string;
  phase?: string;
  searchQuery?: string;
  location?: string | number;
  jobId?: string;
};

export type JobCounter = 'forMe' | 'notApplicable' | 'unknown';

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
  countJob?(counter: JobCounter, jobId?: string): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  success(...args: unknown[]): void;
  error(...args: unknown[]): void;
  forYou(entry: ForYouEntry): void;
  trackUndetermined?(entry: UndeterminedQueueEntry): void;
  br(): void;
  close?(): void;
}
