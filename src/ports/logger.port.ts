import { UndeterminedQueueEntry } from '@shared/types/undetermined-queue-entry.type';
import { TimePostedRange } from '@enums/time-posted-range.enum';
import { WorkType } from '@enums/work-type.enum';

export type LoggerContext = {
  runMode?: string;
  phase?: string;
  searchQuery?: string;
  location?: string | number;
  timePostedRange?: TimePostedRange;
  workType?: WorkType;
  easyApply?: boolean;
  jobId?: string;
  jobTitle?: string;
};

export type JobCounter = 'forMe' | 'notApplicable' | 'unknown';

export type CountedJob = {
  id: string;
  title?: string;
  reason?: string;
  criteria?: string[];
};

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
  countJob?(counter: JobCounter, job?: string | CountedJob): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  success(...args: unknown[]): void;
  error(...args: unknown[]): void;
  forYou(entry: ForYouEntry): void;
  trackUndetermined?(entry: UndeterminedQueueEntry): void;
  br(): void;
  close?(): void;
}
