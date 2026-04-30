import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { PersistedJobRuleManager } from '@config/rules';
import { JobRuleScope, PersistedJobRule } from '@config/rules/persisted-job-rule.type';
import { InteractionActionLabels } from '@ports/interaction.port';
import { ScannerPreferencesFileRepository } from '@config/scanner-preferences-file.repository';
import { ForYouEntry, JobCounter, LoggerContext } from '@ports/logger.port';
import { ManualReviewEntry } from '@shared/types/manual-review-entry.type';
import { ScannerPreferences } from '@shared/types/scanner-preferences.type';
import { UndeterminedQueueDecision, UndeterminedQueueEntry } from '@shared/types/undetermined-queue-entry.type';

export type TerminalLogLevel = 'error' | 'success' | 'warn' | 'info';

export type TerminalRuleCatalog = Record<JobRuleScope, PersistedJobRule[]>;
export type TerminalAdditionalKeywords = Record<JobRuleScope, string[]>;

export type TerminalLogEntry = {
  level: TerminalLogLevel;
  message: string;
  timestamp: string;
};

export type TerminalInputKey = {
  ctrl?: boolean;
  downArrow?: boolean;
  leftArrow?: boolean;
  return?: boolean;
  rightArrow?: boolean;
  tab?: boolean;
  upArrow?: boolean;
  escape?: boolean;
  backspace?: boolean;
  delete?: boolean;
  home?: boolean;
  end?: boolean;
};

export type TerminalRuleDraft = {
  value: string;
  cursorOffset: number;
};

export type TerminalSpawnAction = InteractionActionLabels & {
  id: string;
  statusFilePath: string;
};

export type ManualReviewState = {
  job: ManualReviewEntry;
};

export type TerminalSessionSnapshot = {
  context: LoggerContext;
  additionalKeywords: TerminalAdditionalKeywords;
  excludeDraft: TerminalRuleDraft;
  forYouEntries: ForYouEntry[];
  ruleCatalog: TerminalRuleCatalog;
  jobCounts: Record<JobCounter, number>;
  recentLogs: TerminalLogEntry[];
  spawnActions: TerminalSpawnAction[];
  startedAt: Date;
  undeterminedEntries: UndeterminedQueueEntry[];
  manualReviewState?: ManualReviewState;
};

type TerminalSessionListener = () => void;

type TerminalSessionStoreOptions = {
  preferencesRepository?: ScannerPreferencesFileRepository;
  ruleManager?: PersistedJobRuleManager;
  startedAt?: Date;
};

export class TerminalSessionStore {

  private readonly listeners = new Set<TerminalSessionListener>();
  private readonly preferencesRepository: ScannerPreferencesFileRepository;
  private readonly ruleManager: PersistedJobRuleManager;
  private readonly jobCountersById = new Map<string, JobCounter>();
  private snapshot: TerminalSessionSnapshot;

  constructor(
    private readonly interactiveInput: boolean,
    options: TerminalSessionStoreOptions = {},
  ) {
    this.preferencesRepository = options.preferencesRepository ?? new ScannerPreferencesFileRepository();
    this.ruleManager = options.ruleManager ?? new PersistedJobRuleManager();
    const scannerPreferences = this.preferencesRepository.read();
    this.snapshot = this.createInitialSnapshot(
      options.startedAt ?? new Date(),
      this.createSelectedRuleCatalog(scannerPreferences),
      this.createAdditionalKeywords(scannerPreferences),
    );
  }

  public subscribe = (listener: TerminalSessionListener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public getSnapshot = (): TerminalSessionSnapshot => {
    return this.snapshot;
  };

  public startAction(labels: InteractionActionLabels): TerminalSpawnAction {
    const spawnAction = this.createSpawnAction(labels);
    const spawnActions = [
      spawnAction,
      ...this.snapshot.spawnActions,
    ].slice(0, 5);

    this.snapshot = {
      ...this.snapshot,
      spawnActions,
    };
    this.emit();

    return spawnAction;
  }

  public completeAction(actionId: string): void {
    this.writeActionStatus(actionId, {
      status: 'succeeded',
    });
  }

  public failAction(actionId: string, error: unknown): void {
    this.writeActionStatus(actionId, {
      status: 'failed',
      message: this.createActionErrorMessage(error),
    });
  }

  public removeActionResources(actionId: string): void {
    const spawnAction = this.findSpawnAction(actionId);
    if (!spawnAction) return;

    this.removeSpawnActionResources(spawnAction);
  }

  private removeSpawnActionResources(spawnAction: TerminalSpawnAction): void {
    fs.rmSync(path.dirname(spawnAction.statusFilePath), {
      recursive: true,
      force: true,
    });
  }

  public setContext(context: Partial<LoggerContext>): void {
    this.snapshot = {
      ...this.snapshot,
      context: {
        ...this.snapshot.context,
        ...context,
      },
    };
    this.emit();
  }

  public setScannerPreferences(preferences: ScannerPreferences): void {
    this.snapshot = {
      ...this.snapshot,
      additionalKeywords: this.createAdditionalKeywords(preferences),
      ruleCatalog: this.createSelectedRuleCatalog(preferences),
    };
    this.emit();
  }

  public countJob(counter: JobCounter, jobId?: string): void {
    if (jobId) {
      this.countJobById(counter, jobId);
      return;
    }

    this.snapshot = {
      ...this.snapshot,
      jobCounts: {
        ...this.snapshot.jobCounts,
        [counter]: this.snapshot.jobCounts[counter] + 1,
      },
    };
    this.emit();
  }

  private countJobById(counter: JobCounter, jobId: string): void {
    const previousCounter = this.jobCountersById.get(jobId);

    if (previousCounter === counter) return;

    this.jobCountersById.set(jobId, counter);
    this.snapshot = {
      ...this.snapshot,
      jobCounts: this.createUpdatedJobCounts(previousCounter, counter),
    };
    this.emit();
  }

  private createUpdatedJobCounts(previousCounter: JobCounter | undefined, counter: JobCounter): Record<JobCounter, number> {
    return {
      ...this.snapshot.jobCounts,
      ...(previousCounter ? { [previousCounter]: this.snapshot.jobCounts[previousCounter] - 1 } : {}),
      [counter]: this.snapshot.jobCounts[counter] + 1,
    };
  }

  public trackLog(level: TerminalLogLevel, message: string): void {
    this.snapshot = {
      ...this.snapshot,
      recentLogs: [
        ...this.snapshot.recentLogs,
        {
          level,
          message,
          timestamp: new Date().toLocaleTimeString('en-US', {
            hour12: false,
          }),
        },
      ].slice(-8),
    };
    this.emit();
  }

  public addForYouEntry(entry: ForYouEntry): void {
    this.snapshot = {
      ...this.snapshot,
      forYouEntries: [
        entry,
        ...this.snapshot.forYouEntries,
      ].slice(0, 3),
    };
    this.emit();
  }

  public trackUndeterminedEntry(entry: UndeterminedQueueEntry): void {
    this.snapshot = {
      ...this.snapshot,
      undeterminedEntries: [
        entry,
        ...this.snapshot.undeterminedEntries.filter(({ id }) => id !== entry.id),
      ].slice(0, 8),
    };
    this.emit();
  }

  public startManualReview(job: ManualReviewEntry): void {
    if (!this.interactiveInput) {
      return;
    }

    this.snapshot = {
      ...this.snapshot,
      manualReviewState: {
        job,
      },
    };
    this.emit();
  }

  public finishManualReview(jobId: string): void {
    const manualReviewState = this.snapshot.manualReviewState;

    if (!manualReviewState) {
      this.updateUndeterminedDecision(jobId, 'dismissed');
      this.emit();
      return;
    }

    if (manualReviewState.job.id !== jobId) {
      return;
    }

    if (manualReviewState.job.classification === 'unknown') {
      this.updateUndeterminedDecision(jobId, 'dismissed');
    }

    this.snapshot = {
      ...this.snapshot,
      manualReviewState: undefined,
    };
    this.emit();
  }

  public handleInput(input: string, key: TerminalInputKey = {}): void {
    if (key.return) {
      this.submitDraft();
      return;
    }

    if (key.escape) {
      this.clearDraft();
      return;
    }

    if (key.leftArrow) {
      this.moveDraftCursorLeft();
      return;
    }

    if (key.rightArrow) {
      this.moveDraftCursorRight();
      return;
    }

    if (key.home) {
      this.updateDraftCursor(0);
      return;
    }

    if (key.end) {
      this.moveDraftCursorToEnd();
      return;
    }

    if (key.backspace) {
      this.deleteCharacterBeforeCursor();
      return;
    }

    if (key.delete) {
      this.deleteCharacterAtCursor();
      return;
    }

    if (!input || key.ctrl) {
      return;
    }

    this.insertDraftInput(input);
  }

  public saveExcludeKeyword(value: string): boolean {
    return this.saveRule('exclude', this.getExcludeRuleValue(value));
  }

  private submitDraft(): void {
    this.saveExcludeKeyword(this.snapshot.excludeDraft.value);
  }

  private getExcludeRuleValue(value: string): string {
    const trimmedValue = value.trim();
    const normalizedValue = trimmedValue.toLowerCase();

    if (normalizedValue.startsWith('/exclude ')) {
      return trimmedValue.slice('/exclude '.length);
    }

    if (normalizedValue.startsWith('exclude:')) {
      return trimmedValue.slice('exclude:'.length);
    }

    return value;
  }

  private saveRule(scope: JobRuleScope, value: string): boolean {
    const cleanedValue = value.trim().replace(/\s+/g, ' ');

    if (!cleanedValue) {
      return false;
    }

    const scannerPreferences = this.preferencesRepository.addAdditionalKeyword(scope, cleanedValue);

    this.snapshot = {
      ...this.snapshot,
      excludeDraft: {
        value: '',
        cursorOffset: 0,
      },
      additionalKeywords: this.createAdditionalKeywords(scannerPreferences),
      ruleCatalog: this.createSelectedRuleCatalog(scannerPreferences),
    };
    this.emit();
    this.trackLog('success', `Saved exclusion keyword "${cleanedValue}".`);
    return true;
  }

  private clearDraft(): void {
    this.updateDraft({
      value: '',
      cursorOffset: 0,
    });
  }

  private moveDraftCursorLeft(): void {
    if (this.snapshot.excludeDraft.cursorOffset === 0) {
      return;
    }

    this.updateDraft({
      cursorOffset: this.snapshot.excludeDraft.cursorOffset - 1,
    });
  }

  private moveDraftCursorRight(): void {
    if (this.snapshot.excludeDraft.cursorOffset === this.snapshot.excludeDraft.value.length) {
      return;
    }

    this.updateDraft({
      cursorOffset: this.snapshot.excludeDraft.cursorOffset + 1,
    });
  }

  private moveDraftCursorToEnd(): void {
    this.updateDraftCursor(this.snapshot.excludeDraft.value.length);
  }

  private updateDraftCursor(cursorOffset: number): void {
    this.updateDraft({
      cursorOffset,
    });
  }

  private deleteCharacterBeforeCursor(): void {
    if (this.snapshot.excludeDraft.cursorOffset === 0) {
      return;
    }

    const nextValue = [
      this.snapshot.excludeDraft.value.slice(0, this.snapshot.excludeDraft.cursorOffset - 1),
      this.snapshot.excludeDraft.value.slice(this.snapshot.excludeDraft.cursorOffset),
    ].join('');

    this.updateDraft({
      value: nextValue,
      cursorOffset: this.snapshot.excludeDraft.cursorOffset - 1,
    });
  }

  private deleteCharacterAtCursor(): void {
    if (this.snapshot.excludeDraft.cursorOffset === this.snapshot.excludeDraft.value.length) {
      return;
    }

    const nextValue = [
      this.snapshot.excludeDraft.value.slice(0, this.snapshot.excludeDraft.cursorOffset),
      this.snapshot.excludeDraft.value.slice(this.snapshot.excludeDraft.cursorOffset + 1),
    ].join('');

    this.updateDraft({
      value: nextValue,
    });
  }

  private insertDraftInput(input: string): void {
    const nextValue = [
      this.snapshot.excludeDraft.value.slice(0, this.snapshot.excludeDraft.cursorOffset),
      input,
      this.snapshot.excludeDraft.value.slice(this.snapshot.excludeDraft.cursorOffset),
    ].join('');

    this.updateDraft({
      value: nextValue,
      cursorOffset: this.snapshot.excludeDraft.cursorOffset + input.length,
    });
  }

  private updateDraft(nextDraft: Partial<TerminalRuleDraft>): void {
    this.snapshot = {
      ...this.snapshot,
      excludeDraft: {
        ...this.snapshot.excludeDraft,
        ...nextDraft,
      },
    };
    this.emit();
  }

  private updateUndeterminedDecision(jobId: string, decision: UndeterminedQueueDecision): void {
    this.snapshot = {
      ...this.snapshot,
      undeterminedEntries: this.snapshot.undeterminedEntries.map((entry) => {
        if (entry.id !== jobId) {
          return entry;
        }

        return {
          ...entry,
          decision,
        };
      }),
    };
  }

  private createInitialSnapshot(
    startedAt: Date,
    ruleCatalog: TerminalRuleCatalog,
    additionalKeywords: TerminalAdditionalKeywords,
  ): TerminalSessionSnapshot {
    return {
      context: {},
      additionalKeywords,
      excludeDraft: this.createDraft(),
      forYouEntries: [],
      ruleCatalog,
      jobCounts: {
        forMe: 0,
        notApplicable: 0,
        unknown: 0,
      },
      recentLogs: [],
      spawnActions: [],
      startedAt,
      undeterminedEntries: [],
    };
  }

  private createSpawnAction(labels: InteractionActionLabels): TerminalSpawnAction {
    const statusDirectoryPath = fs.mkdtempSync(path.join(os.tmpdir(), 'linkedin-scanner-action-'));

    return {
      id: randomUUID(),
      statusFilePath: path.join(statusDirectoryPath, 'status.json'),
      ...labels,
    };
  }

  private writeActionStatus(actionId: string, status: { status: 'succeeded' } | { status: 'failed'; message: string }): void {
    const spawnAction = this.findSpawnAction(actionId);
    if (!spawnAction) return;

    fs.writeFileSync(spawnAction.statusFilePath, `${JSON.stringify(status)}\n`, 'utf-8');
  }

  private findSpawnAction(actionId: string): TerminalSpawnAction | undefined {
    return this.snapshot.spawnActions.find(({ id }) => id === actionId);
  }

  private createActionErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  private createDraft(): TerminalRuleDraft {
    return {
      value: '',
      cursorOffset: 0,
    };
  }

  private createSelectedRuleCatalog(preferences: ScannerPreferences): TerminalRuleCatalog {
    const rulesById = new Map(this.ruleManager.listRules().map((rule) => [rule.id, rule]));

    return {
      include: this.findRulesById(preferences.includeRuleIds, rulesById),
      exclude: this.findRulesById(preferences.excludeRuleIds, rulesById),
    };
  }

  private findRulesById(ruleIds: string[], rulesById: Map<string, PersistedJobRule>): PersistedJobRule[] {
    return ruleIds.flatMap((ruleId) => {
      const rule = rulesById.get(ruleId);
      return rule ? [rule] : [];
    });
  }

  private createAdditionalKeywords(preferences: ScannerPreferences): TerminalAdditionalKeywords {
    return {
      include: [...preferences.includeKeywords],
      exclude: [...preferences.excludeKeywords],
    };
  }

  private emit(): void {
    this.listeners.forEach((listener) => {
      listener();
    });
  }

}
