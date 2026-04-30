import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Box, Text, useBoxMetrics, useInput, useWindowSize, type DOMElement, type Key, type TextProps } from 'ink';
import { Badge, Spinner, StatusMessage, TextInput } from '@inkjs/ui';
import { Location } from '@enums/location.enum';
import { TimePostedRange } from '@enums/time-posted-range.enum';
import { WorkType } from '@enums/work-type.enum';
import {
  TerminalJobEntry,
  TerminalSessionSnapshot,
  TerminalSessionStore,
} from '@tui/terminal-session.store';
import { LoggerContext } from '@ports/logger.port';

type InkTerminalAppProps = {
  store: TerminalSessionStore;
};

type HeaderBadgeProps = {
  color: TextProps['color'];
  label: string;
};

type StatusMessageVariant = 'info' | 'success' | 'error' | 'warning';

const fallbackTerminalRows = 32;
const minimumVisibleRows = 1;

export function InkTerminalApp({ store }: InkTerminalAppProps): React.JSX.Element {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const now = useNowTicker(snapshot.startedAt);
  const { rows } = useWindowSize();
  const terminalRows = getTerminalRows(rows);
  const contentRef = useRef<DOMElement>(null);
  const contentMetrics = useBoxMetrics(contentRef as React.RefObject<DOMElement>);
  const visibleRows = getVisibleRows(contentMetrics.height, terminalRows);

  useInput((input, key) => {
    handleTerminalInput(input, key);
  });

  return (
    <Box flexDirection="column" height={terminalRows}>
      <TerminalHeader context={snapshot.context} elapsedTimeLabel={formatElapsedTime(snapshot.startedAt, now)} />
      <Box flexGrow={1} flexShrink={1} flexDirection="column" paddingX={2} paddingY={1}>
        <Box ref={contentRef} flexGrow={1} flexShrink={1} flexDirection="column" overflowY="hidden">
          <PrimaryContent snapshot={snapshot} visibleRows={visibleRows} />
        </Box>
      </Box>
      <TerminalFooter snapshot={snapshot} store={store} />
    </Box>
  );
}

function getTerminalRows(rows: number): number {
  if (rows > 0) return rows;

  return process.stdout.rows ?? fallbackTerminalRows;
}

function getVisibleRows(contentHeight: number, terminalRows: number): number {
  if (contentHeight > 0) return contentHeight;

  return Math.max(minimumVisibleRows, terminalRows);
}

function TerminalHeader({ context, elapsedTimeLabel }: { context: LoggerContext; elapsedTimeLabel: string }): React.JSX.Element {
  const badges = buildHeaderBadges(context, elapsedTimeLabel);

  return (
    <Box flexDirection="column" paddingX={2}>
      <Text bold color="cyan">LinkedIn Scanner CLI</Text>
      <Box marginTop={1} flexWrap="wrap">
        {badges.map((badge) => (
          <Box key={badge.label} marginRight={1} marginBottom={1}>
            <HeaderBadge color={badge.color} label={badge.label} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function HeaderBadge({ color, label }: HeaderBadgeProps): React.JSX.Element {
  return (
    <Badge color={color}>
      <>{label}</>
    </Badge>
  );
}

function buildHeaderBadges(context: LoggerContext, elapsedTimeLabel: string): HeaderBadgeProps[] {
  return [
    { color: 'blue', label: formatSearchQueryLabel(context.searchQuery) },
    ...buildLocationHeaderBadges(context),
    ...buildScannerFilterBadges(context),
    { color: 'green', label: `Elapsed ${elapsedTimeLabel}` },
  ];
}

function formatSearchQueryLabel(searchQuery: string | undefined): string {
  if (!searchQuery) return 'No active search';

  const trimmedSearchQuery = searchQuery.trim();

  if (!hasSurroundingDoubleQuotes(trimmedSearchQuery)) return toTitleCase(trimmedSearchQuery);

  return `"${toTitleCase(trimmedSearchQuery.slice(1, -1))}"`;
}

function hasSurroundingDoubleQuotes(value: string): boolean {
  if (value.length < 2) return false;
  if (!value.startsWith('"')) return false;

  return value.endsWith('"');
}

function buildLocationHeaderBadges(context: LoggerContext): HeaderBadgeProps[] {
  const locationLabel = formatLocationSearchLabel(context.location);

  if (!locationLabel) return [];

  return [
    { color: 'cyan', label: locationLabel },
  ];
}

function formatLocationSearchLabel(location: LoggerContext['location']): string | undefined {
  const locationLabel = formatLocationLabel(location);

  if (!locationLabel) return undefined;

  return locationLabel;
}

function formatLocationLabel(location: LoggerContext['location']): string | undefined {
  if (location === undefined) return undefined;

  const locationKey = resolveLocationKey(location);

  if (!locationKey) return String(location);

  return toTitleCase(splitCamelCase(locationKey));
}

function resolveLocationKey(location: LoggerContext['location']): string | undefined {
  if (typeof location === 'number') return Location[location];

  const numericLocation = Number(location);

  if (Number.isFinite(numericLocation)) return Location[numericLocation];

  return location;
}

function splitCamelCase(value: string): string {
  return Array.from(value).reduce((formattedValue, character, index) => {
    if (index > 0 && character === character.toUpperCase() && character !== character.toLowerCase()) {
      return `${formattedValue} ${character}`;
    }

    return `${formattedValue}${character}`;
  }, '');
}

function buildScannerFilterBadges(context: LoggerContext): HeaderBadgeProps[] {
  const badges: HeaderBadgeProps[] = [];
  const timePostedRangeLabel = formatTimePostedRangeLabel(context.timePostedRange);
  const workTypeLabel = formatWorkTypeLabel(context.workType);

  if (timePostedRangeLabel) {
    badges.push({ color: 'yellow', label: timePostedRangeLabel });
  }

  if (workTypeLabel) {
    badges.push({ color: 'magenta', label: workTypeLabel });
  }

  if (context.easyApply) {
    badges.push({ color: 'green', label: 'Easy Apply' });
  }

  return badges;
}

function formatTimePostedRangeLabel(timePostedRange: TimePostedRange | undefined): string | undefined {
  if (timePostedRange === TimePostedRange.day) return 'last 24 hours';
  if (timePostedRange === TimePostedRange.week) return 'last 7 days';
  if (timePostedRange === TimePostedRange.month) return 'last 30 days';
  if (timePostedRange === TimePostedRange.any) return 'any time';

  return undefined;
}

function formatWorkTypeLabel(workType: WorkType | undefined): string | undefined {
  if (workType === WorkType.remote) return 'remotely';
  if (workType === WorkType.hybrid) return 'hybrid';
  if (workType === WorkType.onSite) return 'on site';

  return undefined;
}

function toTitleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(' ');
}

function PrimaryContent({ snapshot, visibleRows }: { snapshot: TerminalSessionSnapshot; visibleRows: number }): React.JSX.Element {
  return <JobProcessingView snapshot={snapshot} visibleRows={visibleRows} />;
}

function JobProcessingView({
  snapshot,
  visibleRows,
}: {
  snapshot: TerminalSessionSnapshot;
  visibleRows: number;
}): React.JSX.Element {
  const visibleJobEntries = getVisibleJobEntries(snapshot, visibleRows);

  if (!visibleJobEntries.length) {
    return <RunningActivityLine snapshot={snapshot} />;
  }

  return (
    <Box flexDirection="column">
      {visibleJobEntries.map((job) => (
        <JobProcessingItem key={job.id} job={job} />
      ))}
      <RunningActivityLine snapshot={snapshot} />
    </Box>
  );
}

function getVisibleJobEntries(snapshot: TerminalSessionSnapshot, visibleRows: number): TerminalJobEntry[] {
  const completedJobEntries = getCompletedJobEntries(snapshot);
  const completedJobRows = getCompletedJobRows(snapshot, visibleRows);

  if (completedJobRows === 0) return [];

  return completedJobEntries.slice(-completedJobRows);
}

function getCompletedJobEntries(snapshot: TerminalSessionSnapshot): TerminalJobEntry[] {
  return snapshot.jobEntries.filter((job) => job.status !== 'processing');
}

function getCompletedJobRows(snapshot: TerminalSessionSnapshot, visibleRows: number): number {
  const runningActivityRows = shouldShowRunningActivityLine(snapshot) ? 1 : 0;

  return Math.max(0, visibleRows - runningActivityRows);
}

function JobProcessingItem({
  job,
}: {
  job: TerminalJobEntry;
}): React.JSX.Element {
  return (
    <Box flexDirection="column">
      <JobProcessingLine job={job} />
    </Box>
  );
}

function JobProcessingLine({ job }: { job: TerminalJobEntry }): React.JSX.Element {
  if (job.status === 'processing') {
    return <Spinner label={formatProcessingJobLabel(job)} />;
  }

  return (
    <StatusMessage variant={getJobStatusVariant(job)}>
      {formatJobDecisionMessage(job)}
    </StatusMessage>
  );
}

function formatProcessingJobLabel(job: TerminalJobEntry): string {
  const jobName = formatJobName(job);

  if (!job.phase) return jobName;

  return `${jobName} - ${job.phase}`;
}

function formatJobName(job: TerminalJobEntry): string {
  if (job.title) return job.title;
  if (job.status === 'processing') return 'Current job';

  return 'Untitled job';
}

function formatJobDecisionMessage(job: TerminalJobEntry): string {
  const decisionMessage = `${getJobDecisionLabel(job)} ${formatJobName(job)}`;

  if (!job.reason) return decisionMessage;

  return `${decisionMessage} - ${job.reason}`;
}

function getJobStatusVariant(job: TerminalJobEntry): StatusMessageVariant {
  if (job.status === 'success') return 'success';
  if (job.status === 'error') return 'error';
  if (job.status === 'warning') return 'warning';

  return 'info';
}

function getJobDecisionLabel(job: TerminalJobEntry): string {
  if (job.decision === 'goodFit') return 'Good fit';
  if (job.decision === 'notApplicable') return 'Not a fit';
  if (job.decision === 'unknown') return 'Unknown';
  if (job.decision === 'failed') return 'Error';

  return 'Info';
}

function RunningActivityLine({ snapshot }: { snapshot: TerminalSessionSnapshot }): React.JSX.Element | null {
  if (!shouldShowRunningActivityLine(snapshot)) return null;

  return <Spinner label={formatRunningActivityLabel(snapshot)} />;
}

function shouldShowRunningActivityLine(snapshot: TerminalSessionSnapshot): boolean {
  return snapshot.context.phase !== 'Finished';
}

function formatRunningActivityLabel(snapshot: TerminalSessionSnapshot): string {
  const activeProcessingJob = findActiveProcessingJob(snapshot);

  if (activeProcessingJob) {
    return formatProcessingJobLabel(activeProcessingJob);
  }

  const manualReviewJob = findManualReviewJob(snapshot);

  if (manualReviewJob) {
    return formatProcessingJobLabel(manualReviewJob);
  }

  const latestLog = snapshot.recentLogs[snapshot.recentLogs.length - 1];

  if (latestLog?.level === 'info') {
    return latestLog.message;
  }

  return snapshot.context.phase ?? 'Running...';
}

function findActiveProcessingJob(snapshot: TerminalSessionSnapshot): TerminalJobEntry | undefined {
  if (!snapshot.context.jobId) return undefined;

  return snapshot.jobEntries.find((job) => job.id === snapshot.context.jobId && job.status === 'processing');
}

function findManualReviewJob(snapshot: TerminalSessionSnapshot): TerminalJobEntry | undefined {
  const manualReviewJob = snapshot.manualReviewState?.job;

  if (!manualReviewJob) return undefined;

  return {
    id: manualReviewJob.id,
    title: manualReviewJob.title,
    link: manualReviewJob.link,
    location: manualReviewJob.location,
    criteria: manualReviewJob.criteria,
    status: 'processing',
    decision: 'processing',
    phase: snapshot.context.phase,
  };
}

function TerminalFooter({ snapshot, store }: { snapshot: TerminalSessionSnapshot; store: TerminalSessionStore }): React.JSX.Element | null {
  const [inputResetKey, setInputResetKey] = useState(0);

  if (!shouldShowExcludeInput(snapshot)) {
    return null;
  }

  const saveExcludeKeyword = (value: string) => {
    const saved = store.saveExcludeKeyword(value);

    if (saved) {
      setInputResetKey((resetKey) => resetKey + 1);
    }
  };

  return (
    <Box paddingX={1} height={1} flexShrink={0} width="100%" backgroundColor="#111827">
      <Text bold color="#d1d5db">Exclude jobs containing: </Text>
      <TextInput
        key={inputResetKey}
        defaultValue={snapshot.excludeDraft.value}
        placeholder="keyword or phrase"
        onSubmit={saveExcludeKeyword}
      />
    </Box>
  );
}

function shouldShowExcludeInput(snapshot: TerminalSessionSnapshot): boolean {
  if (snapshot.manualReviewState) return true;

  const jobId = snapshot.context.jobId;

  if (!jobId) return false;

  return snapshot.jobEntries.some((job) => job.id === jobId && job.status === 'processing');
}

function handleTerminalInput(input: string, key: Key): void {
  if (key.ctrl && input === 'c') {
    process.kill(process.pid, 'SIGINT');
    return;
  }
}

function useNowTicker(startedAt: Date): Date {
  const [now, setNow] = useState(() => new Date(startedAt));

  useEffect(() => {
    setNow(new Date());

    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [startedAt]);

  return now;
}

function formatElapsedTime(startedAt: Date, now: Date): string {
  const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000));
  const minutes = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
  const seconds = (elapsedSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}
