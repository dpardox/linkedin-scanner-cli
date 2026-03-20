import { clearScreenDown, cursorTo } from 'node:readline';
import { format as formatMessage } from 'node:util';
import { createLogger, Logger, format, transports } from 'winston';
import { ForYouEntry, LoggerContext, LoggerPort } from '@ports/logger.port';
import { addColors } from 'winston/lib/winston/config';

type LogLevel = 'error' | 'success' | 'warn' | 'info';
type LogEntry = {
  level: LogLevel;
  message: string;
  timestamp: string;
};

export class WinstonAdapter implements LoggerPort {

  private readonly logger: Logger;
  private readonly interactive = Boolean(process.stdout.isTTY);
  private readonly recentLogs: LogEntry[] = [];
  private readonly forYouEntries: ForYouEntry[] = [];
  private readonly counts: Record<LogLevel, number> = {
    error: 0,
    success: 0,
    warn: 0,
    info: 0,
  };
  private readonly startedAt = new Date();
  private readonly maxRecentLogs = 8;
  private readonly maxForYouEntries = 1;
  private context: LoggerContext = {};

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

  constructor () {
    addColors(this.customLevels.colors);

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

    this.logger = createLogger({
      levels: this.customLevels.levels,
      level: 'info',
      format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.splat(),
        format.json(),
      ),
      transports: loggerTransports,
    });

    if (this.interactive) {
      process.stdout.write('\x1b[?25l');
      process.once('exit', this.restoreTerminal);
      process.once('SIGINT', this.handleInterrupt);
      this.render();
    }
  }

  public setContext(context: Partial<LoggerContext>): void {
    this.context = {
      ...this.context,
      ...context,
    };
    this.render();
  }

  public info(message: string, ...args: unknown[]): void {
    this.logger.info(message, ...args);
    this.track('info', message, args);
  }

  public warn(message: string, ...args: unknown[]): void {
    this.logger.warn(message,  ...args);
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
    this.counts.success += 1;
    this.forYouEntries.push(entry);

    if (this.forYouEntries.length > this.maxForYouEntries) {
      this.forYouEntries.shift();
    }

    this.render();
  }

  public br(): void {
    if (!this.interactive) {
      process.stdout.write('\n');
      return;
    }

    this.render();
  }

  private track(level: LogLevel, message: string, args: unknown[]): void {
    const formattedMessage = this.normalizeMessage(formatMessage(message, ...args));
    this.counts[level] += 1;
    this.recentLogs.push({
      level,
      message: formattedMessage,
      timestamp: new Date().toLocaleTimeString('en-US', {
        hour12: false,
      }),
    });

    if (this.recentLogs.length > this.maxRecentLogs) {
      this.recentLogs.shift();
    }

    this.render();
  }

  private render(): void {
    if (!this.interactive) return;

    cursorTo(process.stdout, 0, 0);
    clearScreenDown(process.stdout);
    process.stdout.write(this.buildScreen());
  }

  private buildScreen(): string {
    const lines = [
      this.style('LinkedIn Scanner TUI', 'cyan'),
      this.dim(`Elapsed: ${this.getElapsedTime()} | Run: ${this.context.runMode ?? 'default'}`),
      `Phase: ${this.context.phase ?? '-'}`,
      `Search: ${this.context.searchQuery ?? '-'} | Location: ${this.context.location ?? '-'}`,
      `Job: ${this.context.jobId ?? '-'}`,
      `Events: ${this.style(`ok ${this.counts.success}`, 'green')} | ${this.style(`info ${this.counts.info}`, 'blue')} | ${this.style(`warn ${this.counts.warn}`, 'yellow')} | ${this.style(`err ${this.counts.error}`, 'red')}`,
      '',
      ...this.getActivityPanelLines(),
    ];

    return `${lines.join('\n')}\n`;
  }

  private getActivityPanelLines(): string[] {
    if (this.isManualCheckActive()) {
      return [
        'For you:',
        ...this.getForYouLines(),
      ];
    }

    return [
      'Recent activity:',
      ...this.getLogLines(),
    ];
  }

  private getForYouLines(): string[] {
    if (!this.forYouEntries.length) {
      return [this.dim('  no jobs shortlisted yet')];
    }

    return this.forYouEntries
      .slice()
      .reverse()
      .flatMap(entry => [
        `  ${this.style(entry.title, 'green')}`,
        `    Job ID: ${entry.id}`,
        `    Location: ${entry.location}`,
        `    Language: ${entry.language}`,
        `    Criteria: ${entry.criteria.length ? entry.criteria.join(', ') : 'manual review'}`,
        `    Emails: ${entry.emails.length ? entry.emails.join(', ') : 'not found'}`,
        '    Review: pending manual check',
        `    Link: ${this.style(entry.link, 'blue')}`,
      ]);
  }

  private getLogLines(): string[] {
    if (!this.recentLogs.length) {
      return [this.dim('  waiting for events...')];
    }

    return this.recentLogs.map(log => {
      const badge = this.getBadge(log.level);
      return `  ${this.dim(log.timestamp)} ${badge} ${log.message}`;
    });
  }

  private isManualCheckActive(): boolean {
    return this.context.phase === 'Waiting manual review';
  }

  private getBadge(level: LogLevel): string {
    const labels: Record<LogLevel, string> = {
      error: 'ERR',
      success: 'OK ',
      warn: 'WRN',
      info: 'INF',
    };

    const colors: Record<LogLevel, 'red' | 'green' | 'yellow' | 'blue'> = {
      error: 'red',
      success: 'green',
      warn: 'yellow',
      info: 'blue',
    };

    return this.style(`[${labels[level]}]`, colors[level]);
  }

  private getElapsedTime(): string {
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - this.startedAt.getTime()) / 1000));
    const minutes = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
    const seconds = (elapsedSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  private normalizeMessage(message: string): string {
    return message.replace(/\s+/g, ' ').trim();
  }

  private style(value: string, color: 'blue' | 'cyan' | 'green' | 'red' | 'yellow'): string {
    const palette = {
      blue: '\x1b[34m',
      cyan: '\x1b[36m',
      green: '\x1b[32m',
      red: '\x1b[31m',
      yellow: '\x1b[33m',
    };

    return `${palette[color]}${value}\x1b[0m`;
  }

  private dim(value: string): string {
    return `\x1b[2m${value}\x1b[0m`;
  }

  private readonly restoreTerminal = (): void => {
    if (!this.interactive) return;
    process.stdout.write('\x1b[?25h');
  };

  private readonly handleInterrupt = (): void => {
    this.restoreTerminal();
    process.exit(130);
  };

}
