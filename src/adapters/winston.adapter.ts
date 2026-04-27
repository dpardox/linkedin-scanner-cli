import { format as formatMessage } from 'node:util';
import { createInterface } from 'node:readline/promises';
import React from 'react';
import { render } from 'ink';
import { createLogger, Logger, format, transports } from 'winston';
import { addColors } from 'winston/lib/winston/config';
import { PersistedJobRuleManager } from '@config/rules';
import { InteractionPort } from '@ports/interaction.port';
import { ForYouEntry, JobCounter, LoggerContext, LoggerPort } from '@ports/logger.port';
import { ExecutionOptions } from '@shared/types/execution-options.type';
import { ManualReviewEntry } from '@shared/types/manual-review-entry.type';
import { UndeterminedQueueEntry } from '@shared/types/undetermined-queue-entry.type';
import { InkTerminalApp } from '@tui/terminal-app';
import { TerminalSessionStore } from '@tui/terminal-session.store';

type LogLevel = 'error' | 'success' | 'warn' | 'info';

type WinstonAdapterOptions = {
  ruleManager?: PersistedJobRuleManager;
};

export class WinstonAdapter implements LoggerPort, InteractionPort {

  private static readonly showUnknownJobsQuestion = 'Show unknown jobs? (y/N) ';
  private static readonly showUnknownJobsAnswerYes = 'y';
  private static readonly showUnknownJobsAnswerNo = 'n';

  private readonly logger: Logger;
  private readonly interactive = Boolean(process.stdout.isTTY);
  private readonly interactiveInput = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  private readonly terminalSessionStore: TerminalSessionStore;
  private inkRenderer?: ReturnType<typeof render>;

  private readonly customLevels = {
    levels: {
      error: 0,
      success: 1,
      warn: 2,
      info: 3,
    },
    colors: {
      error: 'red',
      success: 'green',
      warn: 'yellow',
      info: 'blue',
    }
  };

  constructor (options: WinstonAdapterOptions = {}) {
    addColors(this.customLevels.colors);

    this.terminalSessionStore = new TerminalSessionStore(this.interactiveInput, {
      ruleManager: options.ruleManager,
    });
    this.logger = this.createWinstonLogger();

    if (this.interactive) {
      process.once('exit', this.restoreTerminal);
      process.once('SIGINT', this.handleInterrupt);
    }
  }

  public setContext(context: Partial<LoggerContext>): void {
    this.terminalSessionStore.setContext(context);
  }

  public countJob(counter: JobCounter): void {
    this.terminalSessionStore.countJob(counter);
  }

  public info(message: string, ...args: unknown[]): void {
    this.logger.info(message, ...args);
    this.track('info', message, args);
  }

  public warn(message: string, ...args: unknown[]): void {
    this.logger.warn(message, ...args);
    this.track('warn', message, args);
  }

  public error(message: string, ...args: unknown[]): void {
    this.logger.error(message, ...args);
    this.track('error', message, args);
  }

  public success(message: string, ...args: unknown[]): void {
    this.logger.log('success', message, ...args);
    this.track('success', message, args);
  }

  public forYou(entry: ForYouEntry): void {
    this.logger.log('success', 'For you "%O"', entry);
    this.terminalSessionStore.addForYouEntry(entry);
  }

  public trackUndetermined(entry: UndeterminedQueueEntry): void {
    this.terminalSessionStore.trackUndeterminedEntry(entry);
  }

  public br(): void {
    if (this.interactive) {
      return;
    }

    process.stdout.write('\n');
  }

  public async selectExecutionOptions(defaultOptions: ExecutionOptions): Promise<ExecutionOptions> {
    const executionOptions = await this.askExecutionOptions(defaultOptions);
    this.ensureInkRenderer();
    return executionOptions;
  }

  public startManualReview(review: ManualReviewEntry): void {
    this.ensureInkRenderer();
    this.terminalSessionStore.startManualReview(review);
  }

  public finishManualReview(jobId: string): void {
    this.terminalSessionStore.finishManualReview(jobId);
  }

  private createWinstonLogger(): Logger {
    const loggerTransports: Array<transports.ConsoleTransportInstance | transports.FileTransportInstance> = [
      new transports.File({
        filename: 'logs/combined.log'
      }),
    ];

    if (!this.interactive) {
      loggerTransports.unshift(
        new transports.Console({
          format: format.combine(
            format.colorize({ all: true }),
            format.timestamp({ format: 'HH:mm:ss' }),
            format.splat(),
            format.printf(({ level, message, timestamp }) => {
              return `[${timestamp}] ${level}: ${message}`;
            }),
          ),
        }),
      );
    }

    return createLogger({
      levels: this.customLevels.levels,
      level: 'info',
      format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.splat(),
        format.json(),
      ),
      transports: loggerTransports,
    });
  }

  private createInkRenderer(): ReturnType<typeof render> | undefined {
    if (!this.interactive) {
      return undefined;
    }

    return render(React.createElement(InkTerminalApp, {
      store: this.terminalSessionStore,
    }), {
      exitOnCtrlC: false,
    });
  }

  private ensureInkRenderer(): void {
    if (!this.interactive || this.inkRenderer) {
      return;
    }

    this.inkRenderer = this.createInkRenderer();
    this.resumeInputForInkRenderer();
  }

  private resumeInputForInkRenderer(): void {
    if (!this.interactiveInput) {
      return;
    }

    process.stdin.resume();
  }

  private async askExecutionOptions(defaultOptions: ExecutionOptions): Promise<ExecutionOptions> {
    if (!this.interactiveInput) {
      return defaultOptions;
    }

    return {
      ...defaultOptions,
      showUnknownJobs: await this.askShowUnknownJobs(defaultOptions.showUnknownJobs),
    };
  }

  private async askShowUnknownJobs(defaultShowUnknownJobs: boolean): Promise<boolean> {
    const readline = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      const answer = await readline.question(WinstonAdapter.showUnknownJobsQuestion);
      return this.parseShowUnknownJobsAnswer(answer, defaultShowUnknownJobs);
    } finally {
      readline.close();
    }
  }

  private parseShowUnknownJobsAnswer(answer: string, defaultShowUnknownJobs: boolean): boolean {
    const normalizedAnswer = answer.trim().toLowerCase();

    if (normalizedAnswer === WinstonAdapter.showUnknownJobsAnswerYes) {
      return true;
    }

    if (normalizedAnswer === WinstonAdapter.showUnknownJobsAnswerNo) {
      return false;
    }

    return defaultShowUnknownJobs;
  }

  private track(level: LogLevel, message: string, args: unknown[]): void {
    this.terminalSessionStore.trackLog(level, this.normalizeMessage(formatMessage(message, ...args)));
  }

  private normalizeMessage(message: string): string {
    return message.replace(/\s+/g, ' ').trim();
  }

  private readonly restoreTerminal = (): void => {
    this.inkRenderer?.unmount();
    this.inkRenderer = undefined;
  };

  private readonly handleInterrupt = (): void => {
    this.restoreTerminal();
    process.exit(130);
  };

}
