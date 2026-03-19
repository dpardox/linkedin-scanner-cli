export type LoggerContext = {
  runMode?: string;
  phase?: string;
  searchQuery?: string;
  location?: string | number;
  jobId?: string;
};

export type ForYouEntry = {
  id: string;
  title: string;
  link: string;
  location: string;
  emails: string[];
  language: string;
};

export interface LoggerPort {
  setContext(context: Partial<LoggerContext>): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  success(...args: unknown[]): void;
  error(...args: unknown[]): void;
  forYou(entry: ForYouEntry): void;
  br(): void;
}
