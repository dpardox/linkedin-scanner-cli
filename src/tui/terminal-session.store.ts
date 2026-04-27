import { PersistedJobRuleManager } from '@config/rules';
import { JobRuleScope, PersistedJobRule } from '@config/rules/persisted-job-rule.type';
import { ForYouEntry, JobCounter, LoggerContext } from '@ports/logger.port';
import { ManualReviewEntry } from '@shared/types/manual-review-entry.type';
import { UndeterminedQueueDecision, UndeterminedQueueEntry } from '@shared/types/undetermined-queue-entry.type';

export type TerminalLogLevel = 'error' | 'success' | 'warn' | 'info';

export type TerminalRuleCatalog = Record<JobRuleScope, PersistedJobRule[]>;

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

export type ManualReviewState = {
  job: ManualReviewEntry;
};

export type TerminalSessionSnapshot = {
  context: LoggerContext;
  excludeDraft: TerminalRuleDraft;
  forYouEntries: ForYouEntry[];
  ruleCatalog: TerminalRuleCatalog;
  jobCounts: Record<JobCounter, number>;
  recentLogs: TerminalLogEntry[];
  startedAt: Date;
  undeterminedEntries: UndeterminedQueueEntry[];
  manualReviewState?: ManualReviewState;
};

type TerminalSessionListener = () => void;

type TerminalSessionStoreOptions = {
  ruleManager?: PersistedJobRuleManager;
  startedAt?: Date;
};

export class TerminalSessionStore {

  private readonly listeners = new Set<TerminalSessionListener>();
  private readonly ruleManager: PersistedJobRuleManager;
  private snapshot: TerminalSessionSnapshot;

  constructor(
    private readonly interactiveInput: boolean,
    options: TerminalSessionStoreOptions = {},
  ) {
    this.ruleManager = options.ruleManager ?? new PersistedJobRuleManager();
    this.snapshot = this.createInitialSnapshot(
      options.startedAt ?? new Date(),
      this.readRuleCatalog(),
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

  public countJob(counter: JobCounter): void {
    this.snapshot = {
      ...this.snapshot,
      jobCounts: {
        ...this.snapshot.jobCounts,
        [counter]: this.snapshot.jobCounts[counter] + 1,
      },
    };
    this.emit();
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

  private submitDraft(): void {
    this.saveRule('exclude', this.getExcludeRuleValue(this.snapshot.excludeDraft.value));
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

  private saveRule(scope: JobRuleScope, value: string): void {
    const cleanedValue = value.trim().replace(/\s+/g, ' ');

    if (!cleanedValue) {
      return;
    }

    const persistedRule = this.ruleManager.upsertRule({
      id: this.createRuleId(scope, cleanedValue),
      name: cleanedValue,
      kind: 'term',
      scope,
      terms: [cleanedValue],
    });

    this.snapshot = {
      ...this.snapshot,
      excludeDraft: {
        value: '',
        cursorOffset: 0,
      },
      ruleCatalog: this.readRuleCatalog(),
    };
    this.emit();
    this.trackLog('success', `Saved ${scope} rule "${persistedRule.name}".`);
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

  private createInitialSnapshot(startedAt: Date, ruleCatalog: TerminalRuleCatalog): TerminalSessionSnapshot {
    return {
      context: {},
      excludeDraft: this.createDraft(),
      forYouEntries: [],
      ruleCatalog,
      jobCounts: {
        skipped: 0,
        found: 0,
        discarded: 0,
        undetermined: 0,
      },
      recentLogs: [],
      startedAt,
      undeterminedEntries: [],
    };
  }

  private createDraft(): TerminalRuleDraft {
    return {
      value: '',
      cursorOffset: 0,
    };
  }

  private readRuleCatalog(): TerminalRuleCatalog {
    return {
      include: this.sortRules(this.ruleManager.listRules('include')),
      exclude: this.sortRules(this.ruleManager.listRules('exclude')),
    };
  }

  private sortRules(rules: PersistedJobRule[]): PersistedJobRule[] {
    return [...rules].reverse();
  }

  private createRuleId(scope: JobRuleScope, value: string): string {
    return `${scope}-${this.slugify(value)}`;
  }

  private slugify(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      || 'rule';
  }

  private emit(): void {
    this.listeners.forEach((listener) => {
      listener();
    });
  }

}
