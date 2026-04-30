import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { PersistedJobRuleManager } from '@config/rules';
import { JobRuleScope, PersistedJobRule } from '@config/rules/persisted-job-rule.type';
import { InteractionActionLabels } from '@ports/interaction.port';
import { ScannerPreferencesFileRepository } from '@config/scanner-preferences-file.repository';
import { CountedJob, ForYouEntry, JobCounter, LoggerContext } from '@ports/logger.port';
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

export type TerminalJobEntryStatus = 'processing' | 'success' | 'error' | 'warning' | 'info';
export type TerminalJobEntryDecision = 'processing' | 'goodFit' | 'notApplicable' | 'unknown' | 'failed';

export type TerminalJobEntry = {
  id: string;
  title?: string;
  link?: string;
  location?: string;
  criteria: string[];
  status: TerminalJobEntryStatus;
  decision: TerminalJobEntryDecision;
  phase?: string;
  message?: string;
  reason?: string;
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
  jobEntries: TerminalJobEntry[];
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
    const nextContext = this.createNextContext(context);

    this.snapshot = {
      ...this.snapshot,
      context: nextContext,
      jobEntries: this.createContextJobEntries(context, nextContext),
    };
    this.emit();
  }

  private createNextContext(context: Partial<LoggerContext>): LoggerContext {
    const nextContext = {
      ...this.snapshot.context,
      ...context,
    };

    if (context.jobId !== undefined && context.jobId !== this.snapshot.context.jobId && context.jobTitle === undefined) {
      return {
        ...nextContext,
        jobTitle: undefined,
      };
    }

    return nextContext;
  }

  private createContextJobEntries(
    context: Partial<LoggerContext>,
    nextContext: LoggerContext,
  ): TerminalJobEntry[] {
    if (!context.jobId) {
      return this.snapshot.jobEntries;
    }

    const currentJobEntry = this.findJobEntry(context.jobId);

    if (currentJobEntry && currentJobEntry.status !== 'processing') {
      return this.snapshot.jobEntries;
    }

    return this.upsertJobEntry(this.snapshot.jobEntries, {
      id: context.jobId,
      title: nextContext.jobTitle,
      criteria: [],
      status: 'processing',
      decision: 'processing',
      phase: nextContext.phase,
    });
  }

  public setScannerPreferences(preferences: ScannerPreferences): void {
    this.snapshot = {
      ...this.snapshot,
      additionalKeywords: this.createAdditionalKeywords(preferences),
      ruleCatalog: this.createSelectedRuleCatalog(preferences),
    };
    this.emit();
  }

  public countJob(counter: JobCounter, job?: string | CountedJob): void {
    if (job) {
      this.countJobById(counter, this.createCountedJob(job));
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

  private countJobById(counter: JobCounter, job: CountedJob): void {
    const jobId = job.id;
    const previousCounter = this.jobCountersById.get(jobId);

    if (previousCounter === counter) return;

    this.jobCountersById.set(jobId, counter);
    this.snapshot = {
      ...this.snapshot,
      jobCounts: this.createUpdatedJobCounts(previousCounter, counter),
      jobEntries: this.upsertJobEntry(this.snapshot.jobEntries, this.createCountedJobEntry(counter, job)),
    };
    this.emit();
  }

  private createCountedJob(job: string | CountedJob): CountedJob {
    if (typeof job === 'string') {
      return {
        id: job,
      };
    }

    return job;
  }

  private createCountedJobEntry(counter: JobCounter, job: CountedJob): TerminalJobEntry {
    if (counter === 'forMe') {
      return {
        id: job.id,
        title: job.title,
        criteria: job.criteria ?? [],
        status: 'success',
        decision: 'goodFit',
        phase: this.snapshot.context.phase,
        reason: job.reason,
      };
    }

    if (counter === 'notApplicable') {
      return {
        id: job.id,
        title: job.title,
        criteria: job.criteria ?? [],
        status: 'error',
        decision: 'notApplicable',
        phase: this.snapshot.context.phase,
        reason: job.reason,
      };
    }

    return {
      id: job.id,
      title: job.title,
      criteria: job.criteria ?? [],
      status: 'warning',
      decision: 'unknown',
      phase: this.snapshot.context.phase,
      reason: job.reason,
    };
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
      jobEntries: this.createLoggedJobEntries(level, message),
    };
    this.emit();
  }

  private createLoggedJobEntries(level: TerminalLogLevel, message: string): TerminalJobEntry[] {
    const jobId = this.getActiveJobId();

    if (!jobId) {
      return this.snapshot.jobEntries;
    }

    const currentJobEntry = this.findJobEntry(jobId);

    if (currentJobEntry && currentJobEntry.status !== 'processing') {
      return this.snapshot.jobEntries;
    }

    if (level === 'error') {
      return this.upsertJobEntry(this.snapshot.jobEntries, {
        id: jobId,
        title: this.snapshot.context.jobTitle,
        criteria: [],
        status: 'error',
        decision: 'failed',
        phase: this.snapshot.context.phase,
        message,
        reason: message,
      });
    }

    return this.upsertJobEntry(this.snapshot.jobEntries, {
      id: jobId,
      title: this.snapshot.context.jobTitle,
      criteria: [],
      status: 'processing',
      decision: 'processing',
      phase: this.snapshot.context.phase,
      message,
    });
  }

  private getActiveJobId(): string | undefined {
    return this.snapshot.manualReviewState?.job.id ?? this.snapshot.context.jobId;
  }

  public addForYouEntry(entry: ForYouEntry): void {
    this.snapshot = {
      ...this.snapshot,
      forYouEntries: [
        entry,
        ...this.snapshot.forYouEntries,
      ].slice(0, 3),
      jobEntries: this.upsertJobEntry(this.snapshot.jobEntries, this.createJobEntryDetails(entry)),
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
      jobEntries: this.upsertJobEntry(this.snapshot.jobEntries, {
        id: entry.id,
        title: entry.title,
        link: entry.link,
        location: entry.location,
        criteria: ['Unknown'],
        status: 'warning',
        decision: 'unknown',
        phase: this.snapshot.context.phase,
        reason: 'No include or exclude keywords matched',
      }),
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
      jobEntries: this.upsertJobEntry(this.snapshot.jobEntries, {
        id: job.id,
        title: job.title,
        link: job.link,
        location: job.location,
        criteria: job.criteria,
        status: job.classification === 'include' ? 'success' : 'warning',
        decision: job.classification === 'include' ? 'goodFit' : 'unknown',
        phase: this.snapshot.context.phase,
        reason: this.createManualReviewReason(job),
      }),
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
      jobEntries: this.createReviewedJobEntries(jobId),
    };
    this.emit();
  }

  private createReviewedJobEntries(jobId: string): TerminalJobEntry[] {
    const jobEntry = this.findJobEntry(jobId);

    if (!jobEntry) {
      return this.snapshot.jobEntries;
    }

    return this.upsertJobEntry(this.snapshot.jobEntries, {
      ...jobEntry,
      phase: 'Reviewed',
      message: undefined,
    });
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

  private createJobEntryDetails(entry: ForYouEntry): TerminalJobEntry {
    return {
      id: entry.id,
      title: entry.title,
      link: entry.link,
      location: entry.location,
      criteria: entry.criteria,
      status: 'info',
      decision: 'processing',
      phase: this.snapshot.context.phase,
    };
  }

  private createManualReviewReason(job: ManualReviewEntry): string {
    if (job.classification === 'include') {
      return this.createCriteriaReason('Matched include keywords', job.criteria);
    }

    return 'No include or exclude keywords matched';
  }

  private createCriteriaReason(label: string, criteria: string[]): string {
    if (!criteria.length) return label;

    return `${label}: ${criteria.join(', ')}`;
  }

  private upsertJobEntry(entries: TerminalJobEntry[], entry: TerminalJobEntry): TerminalJobEntry[] {
    const currentEntry = entries.find(({ id }) => id === entry.id);
    const nextEntry = currentEntry ? this.mergeJobEntry(currentEntry, entry) : entry;

    if (currentEntry) {
      return entries.map((existingEntry) => existingEntry.id === entry.id ? nextEntry : existingEntry);
    }

    return [
      ...entries,
      nextEntry,
    ];
  }

  private mergeJobEntry(currentEntry: TerminalJobEntry, nextEntry: TerminalJobEntry): TerminalJobEntry {
    return {
      id: nextEntry.id,
      title: nextEntry.title ?? currentEntry.title,
      link: nextEntry.link ?? currentEntry.link,
      location: nextEntry.location ?? currentEntry.location,
      criteria: nextEntry.criteria.length ? nextEntry.criteria : currentEntry.criteria,
      status: nextEntry.status === 'info' ? currentEntry.status : nextEntry.status,
      decision: nextEntry.decision === 'processing' ? currentEntry.decision : nextEntry.decision,
      phase: nextEntry.phase ?? currentEntry.phase,
      message: nextEntry.message ?? currentEntry.message,
      reason: nextEntry.reason ?? currentEntry.reason,
    };
  }

  private findJobEntry(jobId: string): TerminalJobEntry | undefined {
    return this.snapshot.jobEntries.find(({ id }) => id === jobId);
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
      jobEntries: [],
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
