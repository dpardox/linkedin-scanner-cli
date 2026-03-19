export type LoggerContext = {
  runMode?: string;
  phase?: string;
  searchQuery?: string;
  location?: string | number;
  jobId?: string;
};

export interface LoggerPort {
  setContext(context: Partial<LoggerContext>): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  success(...args: unknown[]): void;
  error(...args: unknown[]): void;
  br(): void;
}
