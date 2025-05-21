import { createLogger, Logger, format, transports } from 'winston';
import { LoggerPort } from '@ports/logger.port';
import { addColors } from 'winston/lib/winston/config';

export class WinstonAdapter implements LoggerPort {

  private readonly logger: Logger;

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

    this.logger = createLogger({
      levels: this.customLevels.levels,
      level: 'info',
      format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.splat(),
        format.json(),
      ),
      transports: [
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
        // new transports.File({ filename: 'logs/error.log', level: 'error' }),
        new transports.File({
          filename: 'logs/combined.log'
        }),
      ],
    });
  }

  public info(message: string, ...args: unknown[]): void {
    this.logger.info(message, ...args);
  }

  public warn(message: string, ...args: unknown[]): void {
    this.logger.warn(message,  ...args);
  }

  public error(message: string, ...args: unknown[]): void {
    this.logger.error(message, ...args);
  }

  public success(message: string, ...args: unknown[]): void {
    this.logger.log('success', message, ...args);
  }

  public br(): void {
    console.log('');
  }

}

// TODO (dpardo): move to plugins
