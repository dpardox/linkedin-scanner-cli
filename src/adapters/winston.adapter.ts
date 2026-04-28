import { format as formatMessage } from 'node:util';
import React from 'react';
import { render } from 'ink';
import { createLogger, Logger, format, transports } from 'winston';
import { addColors } from 'winston/lib/winston/config';
import { PersistedJobRuleManager } from '@config/rules';
import { PersistedJobRule } from '@config/rules/persisted-job-rule.type';
import { LanguageCode } from '@enums/language-code.enum';
import { Location } from '@enums/location.enum';
import { WorkType } from '@enums/work-type.enum';
import { InteractionPort } from '@ports/interaction.port';
import { ForYouEntry, JobCounter, LoggerContext, LoggerPort } from '@ports/logger.port';
import { ExecutionOptions } from '@shared/types/execution-options.type';
import { ManualReviewEntry } from '@shared/types/manual-review-entry.type';
import { LocationKey, ScannerPreferences } from '@shared/types/scanner-preferences.type';
import { UndeterminedQueueEntry } from '@shared/types/undetermined-queue-entry.type';
import { InkTerminalApp } from '@tui/terminal-app';
import { selectTerminalOptions } from '@tui/multi-select-prompt';
import { TerminalSessionStore } from '@tui/terminal-session.store';
import { askTerminalText } from '@tui/text-prompt';

type LogLevel = 'error' | 'success' | 'warn' | 'info';

type MenuOption<T extends string> = {
  label: string;
  value: T;
};

type WinstonAdapterOptions = {
  ruleManager?: PersistedJobRuleManager;
};

export class WinstonAdapter implements LoggerPort, InteractionPort {

  private static readonly showUnknownJobsAnswerYes = 'y';
  private static readonly showUnknownJobsAnswerNo = 'n';
  private static readonly locationOptions = Object.keys(Location)
    .filter((locationKey) => Number.isNaN(Number(locationKey)))
    .map((locationKey) => ({
      label: WinstonAdapter.humanizeLocationKey(locationKey),
      value: locationKey as LocationKey,
    }));
  private static readonly languageOptions: Array<MenuOption<string>> = [
    { label: 'English (eng)', value: LanguageCode.english },
    { label: 'Spanish (spa)', value: LanguageCode.spanish },
    { label: 'Portuguese (por)', value: LanguageCode.portuguese },
    { label: 'French (fra)', value: LanguageCode.french },
    { label: 'German (deu)', value: LanguageCode.german },
    { label: 'Italian (ita)', value: LanguageCode.italian },
  ];
  private static readonly workTypeOptions: Array<MenuOption<WorkType>> = [
    { label: 'Remote', value: WorkType.remote },
    { label: 'Hybrid', value: WorkType.hybrid },
    { label: 'On site', value: WorkType.onSite },
  ];

  private readonly logger: Logger;
  private readonly ruleManager: PersistedJobRuleManager;
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

    this.ruleManager = options.ruleManager ?? new PersistedJobRuleManager();
    this.terminalSessionStore = new TerminalSessionStore(this.interactiveInput, {
      ruleManager: this.ruleManager,
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

  public async selectScannerPreferences(
    defaultPreferences: ScannerPreferences,
  ): Promise<ScannerPreferences> {
    if (!this.interactiveInput) {
      this.terminalSessionStore.setScannerPreferences(defaultPreferences);
      return defaultPreferences;
    }

    const scannerPreferences = await this.askScannerPreferences(defaultPreferences);
    this.terminalSessionStore.setScannerPreferences(scannerPreferences);
    return scannerPreferences;
  }

  public async selectExecutionOptions(defaultOptions: ExecutionOptions): Promise<ExecutionOptions> {
    this.ensureInkRenderer();
    return defaultOptions;
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

  private async askScannerPreferences(defaultPreferences: ScannerPreferences): Promise<ScannerPreferences> {
    const searchQueries = await this.askTextList('Search queries', defaultPreferences.searchQueries);
    const locationKeys = await this.askLocationKeys(defaultPreferences.locationKeys);
    const languages = await this.askLanguages(defaultPreferences.languages);
    const workType = await this.askWorkType(defaultPreferences.filters.workType);
    const easyApply = await this.askBoolean('Easy Apply only?', defaultPreferences.filters.easyApply ?? true);
    const includeRuleIds = await this.askIncludeKeywordRuleIds(defaultPreferences.includeRuleIds);
    const excludeRuleIds = await this.askExcludeKeywordRuleIds(defaultPreferences.excludeRuleIds, includeRuleIds);
    const contentSearchQuery = await this.askText('Final content search query', defaultPreferences.contentSearchQuery);
    const showUnknownJobs = await this.askBoolean('Show unknown jobs?', defaultPreferences.showUnknownJobs);

    return {
      ...defaultPreferences,
      searchQueries,
      locationKeys,
      languages,
      filters: {
        ...defaultPreferences.filters,
        workType,
        easyApply,
      },
      includeRuleIds,
      excludeRuleIds,
      contentSearchQuery,
      showUnknownJobs,
    };
  }

  private async askTextList(
    label: string,
    defaultValues: string[],
  ): Promise<string[]> {
    const answer = await askTerminalText(label, defaultValues.join(', '));
    const values = this.parseTextList(answer);
    if (!values.length) return defaultValues;

    return values;
  }

  private async askLocationKeys(defaultLocationKeys: LocationKey[]): Promise<LocationKey[]> {
    return await selectTerminalOptions({
      title: 'Countries or locations',
      options: WinstonAdapter.locationOptions,
      selectedValues: defaultLocationKeys,
    });
  }

  private async askLanguages(defaultLanguages: string[]): Promise<string[]> {
    return await selectTerminalOptions({
      title: 'Languages',
      options: WinstonAdapter.languageOptions,
      selectedValues: defaultLanguages,
    });
  }

  private async askWorkType(defaultWorkType?: WorkType): Promise<WorkType | undefined> {
    const selectedWorkTypes = await selectTerminalOptions({
      title: 'Work type',
      options: WinstonAdapter.workTypeOptions,
      selectedValues: defaultWorkType ? [defaultWorkType] : [],
      multiple: false,
    });

    return selectedWorkTypes[0];
  }

  private async askBoolean(
    label: string,
    defaultValue: boolean,
  ): Promise<boolean> {
    const selectedValue = await selectTerminalOptions({
      title: label,
      options: [
        { label: 'Yes', value: WinstonAdapter.showUnknownJobsAnswerYes },
        { label: 'No', value: WinstonAdapter.showUnknownJobsAnswerNo },
      ],
      selectedValues: [defaultValue ? WinstonAdapter.showUnknownJobsAnswerYes : WinstonAdapter.showUnknownJobsAnswerNo],
      multiple: false,
    });

    return selectedValue[0] === WinstonAdapter.showUnknownJobsAnswerYes;
  }

  private async askIncludeKeywordRuleIds(defaultRuleIds: string[]): Promise<string[]> {
    return await this.askRuleIds('Include keywords', defaultRuleIds, [], this.listKeywordRules());
  }

  private async askExcludeKeywordRuleIds(
    defaultRuleIds: string[],
    includeRuleIds: string[],
  ): Promise<string[]> {
    const defaultExcludeRuleIds = defaultRuleIds.filter((ruleId) => !includeRuleIds.includes(ruleId));
    return await this.askRuleIds('Exclude keywords', defaultExcludeRuleIds, includeRuleIds, this.listRules());
  }

  private async askRuleIds(
    title: string,
    defaultRuleIds: string[],
    hiddenKeywordRuleIds: string[] = [],
    rules: PersistedJobRule[],
  ): Promise<string[]> {
    const keywordOptions = this.createRuleOptions(rules, hiddenKeywordRuleIds);
    if (!keywordOptions.length) return defaultRuleIds;

    const selectedKeywordRuleIds = await selectTerminalOptions({
      title,
      options: keywordOptions,
      selectedValues: this.getSelectedRuleIds(defaultRuleIds, hiddenKeywordRuleIds, rules),
    });

    return this.mergeVisibleAndHiddenRuleIds(defaultRuleIds, selectedKeywordRuleIds, keywordOptions);
  }

  private createRuleOptions(rules: PersistedJobRule[], hiddenKeywordRuleIds: string[]): Array<MenuOption<string>> {
    const hiddenKeywordRuleIdSet = new Set(hiddenKeywordRuleIds);

    return rules
      .filter((rule) => !hiddenKeywordRuleIdSet.has(rule.id))
      .map((rule) => ({
        label: rule.name,
        value: rule.id,
      }));
  }

  private getSelectedRuleIds(
    ruleIds: string[],
    hiddenKeywordRuleIds: string[],
    rules: PersistedJobRule[],
  ): string[] {
    const hiddenKeywordRuleIdSet = new Set(hiddenKeywordRuleIds);
    const availableRuleIds = new Set(rules.map((rule) => rule.id));

    return ruleIds.filter((ruleId) => availableRuleIds.has(ruleId) && !hiddenKeywordRuleIdSet.has(ruleId));
  }

  private listRules(): PersistedJobRule[] {
    return this.dedupeRules(this.ruleManager.listRules());
  }

  private listKeywordRules(): PersistedJobRule[] {
    return this.dedupeRules(this.ruleManager.listRules().filter((rule) => rule.kind === 'keyword'));
  }

  private dedupeRules(rules: PersistedJobRule[]): PersistedJobRule[] {
    const rulesById = new Map<string, PersistedJobRule>();

    rules.forEach((rule) => {
      if (rulesById.has(rule.id)) return;

      rulesById.set(rule.id, rule);
    });

    return Array.from(rulesById.values());
  }

  private mergeVisibleAndHiddenRuleIds(
    defaultRuleIds: string[],
    selectedVisibleRuleIds: string[],
    visibleOptions: Array<MenuOption<string>>,
  ): string[] {
    const visibleRuleIds = new Set(visibleOptions.map((option) => option.value));
    const selectedVisibleRuleIdSet = new Set(selectedVisibleRuleIds);
    const selectedDefaultRuleIds = defaultRuleIds.filter((ruleId) => {
      if (!visibleRuleIds.has(ruleId)) return true;

      return selectedVisibleRuleIdSet.has(ruleId);
    });
    const newSelectedVisibleRuleIds = selectedVisibleRuleIds.filter((ruleId) => !defaultRuleIds.includes(ruleId));

    return [...selectedDefaultRuleIds, ...newSelectedVisibleRuleIds];
  }

  private async askText(
    label: string,
    defaultValue: string,
  ): Promise<string> {
    const answer = await askTerminalText(label, defaultValue);
    const value = answer.trim();
    if (!value) return defaultValue;

    return value;
  }

  private parseTextList(answer: string): string[] {
    return answer
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }

  private static humanizeLocationKey(locationKey: string): string {
    return locationKey
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (firstCharacter) => firstCharacter.toUpperCase());
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
