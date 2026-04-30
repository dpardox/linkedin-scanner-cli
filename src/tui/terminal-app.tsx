import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Box, Text, useInput, type Key, type TextProps } from 'ink';
import { Badge, Spinner, TextInput } from '@inkjs/ui';
import Link from 'ink-link';
import { Spawn } from 'ink-spawn';
import { Location } from '@enums/location.enum';
import { TimePostedRange } from '@enums/time-posted-range.enum';
import { WorkType } from '@enums/work-type.enum';
import { JobCounter, LoggerContext } from '@ports/logger.port';
import {
  TerminalLogEntry,
  TerminalSessionSnapshot,
  TerminalSpawnAction,
  TerminalSessionStore,
} from '@tui/terminal-session.store';

type InkTerminalAppProps = {
  store: TerminalSessionStore;
};

type SessionSummaryRow = {
  label: string;
  value: string;
};

type JobStatsCounterRow = {
  counter: JobCounter;
  label: string;
  color: string;
};

type JobStatsCounterEntry = JobStatsCounterRow & {
  value: number;
};

type HeaderBadgeProps = {
  color: TextProps['color'];
  label: string;
};

const actionStatusPollIntervalMs = 50;
const actionStatusTimeoutMs = 30000;
const jobStatsCounterLabelWidth = 9;
const sessionDashboardCountersGap = 4;

const jobStatsCounterRows: JobStatsCounterRow[] = [
  { counter: 'forMe', label: 'Good fit', color: '#4ade80' },
  { counter: 'notApplicable', label: 'Not a fit', color: 'red' },
  { counter: 'unknown', label: 'Unknown', color: 'yellow' },
];

export function InkTerminalApp({ store }: InkTerminalAppProps): React.JSX.Element {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const now = useNowTicker(snapshot.startedAt);

  useInput((input, key) => {
    handleTerminalInput(input, key);
  });

  return (
    <Box flexDirection="column" height={process.stdout.rows ?? 32}>
      <TerminalHeader context={snapshot.context} elapsedTimeLabel={formatElapsedTime(snapshot.startedAt, now)} />
      <Box flexGrow={1} flexShrink={1} flexDirection="column" paddingX={2} paddingY={1}>
        <PrimaryContent snapshot={snapshot} />
      </Box>
      <TerminalFooter snapshot={snapshot} store={store} />
    </Box>
  );
}

function TerminalHeader({ context, elapsedTimeLabel }: { context: LoggerContext; elapsedTimeLabel: string }): React.JSX.Element {
  return (
    <Box flexDirection="column" paddingX={2}>
      <Text bold color="cyan">LinkedIn Scanner CLI</Text>
      <Box marginTop={1}>
        <HeaderBadge color="blue" label={buildScannerSummaryBadgeLabel(context)} />
        <Box marginLeft={1}>
          <HeaderBadge color="green" label={`Elapsed ${elapsedTimeLabel}`} />
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>{context.phase ?? 'Idle'}</Text>
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

function buildScannerSummaryBadgeLabel(context: LoggerContext): string {
  const scannerSummaryParts = [
    formatSearchQueryLabel(context.searchQuery),
    formatLocationSearchLabel(context.location),
    ...buildScannerFilterLabels(context),
  ].filter((part): part is string => Boolean(part));

  return scannerSummaryParts.join(' ');
}

function formatSearchQueryLabel(searchQuery: string | undefined): string {
  if (!searchQuery) return 'No active search';

  return toTitleCase(removeSurroundingQuotes(searchQuery.trim()));
}

function removeSurroundingQuotes(value: string): string {
  if (value.length < 2) return value;
  if (!value.startsWith('"')) return value;
  if (!value.endsWith('"')) return value;

  return value.slice(1, -1);
}

function formatLocationSearchLabel(location: LoggerContext['location']): string | undefined {
  const locationLabel = formatLocationLabel(location);

  if (!locationLabel) return undefined;

  return `in ${locationLabel}`;
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

function buildScannerFilterLabels(context: LoggerContext): string[] {
  return [
    formatTimePostedRangeLabel(context.timePostedRange),
    formatWorkTypeLabel(context.workType),
    context.easyApply ? 'Easy Apply' : undefined,
  ].filter((part): part is string => Boolean(part));
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

function PrimaryContent({ snapshot }: { snapshot: TerminalSessionSnapshot }): React.JSX.Element {
  if (snapshot.manualReviewState) {
    return <ManualReviewView snapshot={snapshot} />;
  }

  return <RunningView snapshot={snapshot} />;
}

function ManualReviewView({ snapshot }: { snapshot: TerminalSessionSnapshot }): React.JSX.Element {
  const manualReviewState = snapshot.manualReviewState;

  if (!manualReviewState) {
    return <RunningView snapshot={snapshot} />;
  }

  const reviewLabel = manualReviewState.job.classification === 'unknown'
    ? 'Unknown job pending manual discard'
    : 'Manual review';

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">{reviewLabel}</Text>
      <Box marginTop={1} flexDirection="column">
        <Text>Job: {manualReviewState.job.title || manualReviewState.job.id}</Text>
        <Text>Location: {manualReviewState.job.location || '-'}</Text>
        <Text>Criteria: {manualReviewState.job.criteria.join(', ')}</Text>
        <OfferLink url={manualReviewState.job.link} />
      </Box>
      <Box marginTop={2}>
        <SessionDashboard snapshot={snapshot} />
      </Box>
      <TerminalActionList actions={snapshot.spawnActions} />
      <Box marginTop={2} flexDirection="column">
        <Text dimColor>Activity</Text>
        <ActivityStatus snapshot={snapshot} />
      </Box>
    </Box>
  );
}

function OfferLink({ url }: { url: string }): React.JSX.Element {
  return (
    <Box>
      <Text>Link: </Text>
      <Link url={url} fallback={(text) => text}>{url}</Link>
    </Box>
  );
}

function RunningView({ snapshot }: { snapshot: TerminalSessionSnapshot }): React.JSX.Element {
  return (
    <Box flexDirection="column">
      <Text bold color="cyan">LinkedIn scanner is running.</Text>
      <Box marginTop={2}>
        <SessionDashboard snapshot={snapshot} />
      </Box>
      <TerminalActionList actions={snapshot.spawnActions} />
      <Box marginTop={2} flexDirection="column">
        <Text dimColor>Activity</Text>
        <ActivityStatus snapshot={snapshot} />
      </Box>
    </Box>
  );
}

function SessionDashboard({ snapshot }: { snapshot: TerminalSessionSnapshot }): React.JSX.Element {
  return (
    <Box width="100%">
      <Box flexGrow={1} flexShrink={1}>
        <SessionSummary snapshot={snapshot} />
      </Box>
      <Box marginLeft={sessionDashboardCountersGap} flexShrink={0}>
        <JobStatsCounters snapshot={snapshot} />
      </Box>
    </Box>
  );
}

function SessionSummary({ snapshot }: { snapshot: TerminalSessionSnapshot }): React.JSX.Element {
  return (
    <Box flexDirection="column">
      <Text bold>Session</Text>
      <Box marginTop={1} flexDirection="column">
        {buildSessionSummaryRows(snapshot).map((row) => (
          <SessionSummaryItem key={row.label} row={row} />
        ))}
      </Box>
    </Box>
  );
}

function SessionSummaryItem({ row }: { row: SessionSummaryRow }): React.JSX.Element {
  return (
    <Box>
      <Box width={12} marginRight={1}>
        <Text dimColor>{row.label}</Text>
      </Box>
      <Text>{row.value}</Text>
    </Box>
  );
}

function JobStatsCounters({ snapshot }: { snapshot: TerminalSessionSnapshot }): React.JSX.Element {
  const data = createJobStatsCounterData(snapshot);

  return (
    <Box flexDirection="column">
      <Text bold>Jobs</Text>
      <Box marginTop={1} flexDirection="column">
        {data.map((entry) => (
          <JobStatsCounterEntryRow key={entry.counter} entry={entry} />
        ))}
      </Box>
    </Box>
  );
}

function createJobStatsCounterData(snapshot: TerminalSessionSnapshot): JobStatsCounterEntry[] {
  return jobStatsCounterRows.map((row) => ({
    ...row,
    value: snapshot.jobCounts[row.counter],
  }));
}

function JobStatsCounterEntryRow({ entry }: { entry: JobStatsCounterEntry }): React.JSX.Element {
  return (
    <Box>
      <Box width={jobStatsCounterLabelWidth} marginRight={1}>
        <Text color={entry.color}>{entry.label}</Text>
      </Box>
      <Text color={entry.color}>{entry.value}</Text>
    </Box>
  );
}

function TerminalActionList({ actions }: { actions: TerminalSpawnAction[] }): React.JSX.Element | null {
  if (!actions.length) {
    return null;
  }

  return (
    <Box marginTop={2} flexDirection="column">
      <Text dimColor>Actions</Text>
      {actions.slice().reverse().map((action) => (
        <TerminalSpawnActionView key={action.id} action={action} />
      ))}
    </Box>
  );
}

function TerminalSpawnActionView({ action }: { action: TerminalSpawnAction }): React.JSX.Element {
  const previousExitCode = useRef(process.exitCode);

  return (
    <Spawn
      command={process.execPath}
      args={createActionStatusWaiterArgs(action.statusFilePath)}
      runningText={action.runningText}
      successText={action.successText}
      failureText={action.failureText}
      maxOutputLines={3}
      onCompletion={(error) => {
        if (error) {
          process.exitCode = previousExitCode.current;
        }
      }}
    />
  );
}

function createActionStatusWaiterArgs(statusFilePath: string): string[] {
  return [
    '-e',
    [
      'const fs = require("node:fs/promises");',
      'const statusFilePath = process.argv[1];',
      'const pollIntervalMs = Number(process.argv[2]);',
      'const timeoutMs = Number(process.argv[3]);',
      'const sleep = (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs));',
      'async function readStatus() {',
      '  try {',
      '    return JSON.parse(await fs.readFile(statusFilePath, "utf-8"));',
      '  } catch {',
      '    return undefined;',
      '  }',
      '}',
      'async function waitForStatus() {',
      '  const startedAt = Date.now();',
      '  while (Date.now() - startedAt < timeoutMs) {',
      '    const status = await readStatus();',
      '    if (status?.status === "succeeded") process.exit(0);',
      '    if (status?.status === "failed") {',
      '      if (status.message) console.error(status.message);',
      '      process.exit(1);',
      '    }',
      '    await sleep(pollIntervalMs);',
      '  }',
      '  console.error("Action timed out.");',
      '  process.exit(1);',
      '}',
      'void waitForStatus();',
    ].join('\n'),
    statusFilePath,
    String(actionStatusPollIntervalMs),
    String(actionStatusTimeoutMs),
  ];
}

function TerminalFooter({ snapshot, store }: { snapshot: TerminalSessionSnapshot; store: TerminalSessionStore }): React.JSX.Element {
  const [inputResetKey, setInputResetKey] = useState(0);

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

function ActivityStatus({ snapshot }: { snapshot: TerminalSessionSnapshot }): React.JSX.Element {
  const latestLog = getLatestLog(snapshot.recentLogs);

  if (!latestLog) {
    return <Spinner label={snapshot.context.phase ?? 'Waiting for events...'} />;
  }

  if (latestLog.level === 'info') {
    return <Spinner label={latestLog.message} />;
  }

  return <ActivityResult log={latestLog} />;
}

function getLatestLog(recentLogs: TerminalLogEntry[]): TerminalLogEntry | undefined {
  return recentLogs[recentLogs.length - 1];
}

function ActivityResult({ log }: { log: TerminalLogEntry }): React.JSX.Element {
  return (
    <Text>
      <Text color={getActivityColor(log.level)}>{getActivityLabel(log.level)} </Text>
      <Text>{log.message}</Text>
    </Text>
  );
}

function buildSessionSummaryRows(snapshot: TerminalSessionSnapshot): SessionSummaryRow[] {
  return [
    { label: 'Phase', value: snapshot.context.phase ?? '-' },
    { label: 'Search', value: snapshot.context.searchQuery ?? '-' },
    { label: 'Location', value: String(snapshot.context.location ?? '-') },
    { label: 'Current job', value: snapshot.context.jobId ?? '-' },
    { label: 'Rules', value: `include rules ${snapshot.ruleCatalog.include.length} | exclusion rules ${snapshot.ruleCatalog.exclude.length} | custom exclusions ${snapshot.additionalKeywords.exclude.length}` },
  ];
}

function getActivityLabel(level: TerminalLogEntry['level']): string {
  if (level === 'success') {
    return 'Done';
  }

  if (level === 'warn') {
    return 'Warning';
  }

  if (level === 'error') {
    return 'Error';
  }

  return 'Working';
}

function getActivityColor(level: TerminalLogEntry['level']): 'blue' | 'green' | 'red' | 'yellow' {
  if (level === 'success') {
    return 'green';
  }

  if (level === 'warn') {
    return 'yellow';
  }

  if (level === 'error') {
    return 'red';
  }

  return 'blue';
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
