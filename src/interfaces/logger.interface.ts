export interface Logger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  success(...args: unknown[]): void;
  error(...args: unknown[]): void;
  br(): void;
}

// TODO (dpardo): move to interfaces
