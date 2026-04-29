import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Box, Text, useInput, type Key } from 'ink';
import { StackedBarChart, type StackedBarSegment } from '@pppp606/ink-chart';
import Link from 'ink-link';
import { Spawn } from 'ink-spawn';
import { JobCounter, LoggerContext } from '@ports/logger.port';
import {
  TerminalInputKey,
  TerminalLogEntry,
  TerminalRuleDraft,
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

type JobStatsChartRow = {
  counter: JobCounter;
  label: string;
  color: string;
};

const actionStatusPollIntervalMs = 50;
const actionStatusTimeoutMs = 30000;
const jobStatsChartWidth = 32;
const jobStatsLegendLabelWidth = 10;
const sessionDashboardChartGap = 4;

const jobStatsChartRows: JobStatsChartRow[] = [
  { counter: 'found', label: 'Found', color: 'green' },
  { counter: 'undetermined', label: 'Unknown', color: 'yellow' },
  { counter: 'discarded', label: 'Discarded', color: 'red' },
  { counter: 'skipped', label: 'Skipped', color: 'cyan' },
];

export function InkTerminalApp({ store }: InkTerminalAppProps): React.JSX.Element {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const now = useNowTicker(snapshot.startedAt);

  useInput((input, key) => {
    handleTerminalInput(store, input, key);
  });

  return (
    <Box flexDirection="column" height={process.stdout.rows ?? 32}>
      <TerminalHeader context={snapshot.context} elapsedTimeLabel={formatElapsedTime(snapshot.startedAt, now)} />
      <Box flexGrow={1} flexShrink={1} flexDirection="column" paddingX={2} paddingY={1}>
        <PrimaryContent snapshot={snapshot} />
      </Box>
      <TerminalFooter snapshot={snapshot} />
    </Box>
  );
}

function TerminalHeader({ context, elapsedTimeLabel }: { context: LoggerContext; elapsedTimeLabel: string }): React.JSX.Element {
  return (
    <Box flexDirection="column">
      <Box justifyContent="space-between" paddingX={1}>
        <Text inverse bold> linkedin-scanner-cli </Text>
        <Text inverse>{buildHeaderModeLabel(context)}</Text>
      </Box>
      <Box justifyContent="space-between" paddingX={1}>
        <Text dimColor>{context.phase ?? 'Idle'}</Text>
        <Text dimColor>{elapsedTimeLabel}</Text>
      </Box>
    </Box>
  );
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
        <Text dimColor>Recent activity</Text>
        {renderActivityLines(snapshot.recentLogs)}
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
        <Text dimColor>Recent activity</Text>
        {renderActivityLines(snapshot.recentLogs)}
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
      <Box marginLeft={sessionDashboardChartGap} flexShrink={0}>
        <JobStatsChart snapshot={snapshot} />
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

function JobStatsChart({ snapshot }: { snapshot: TerminalSessionSnapshot }): React.JSX.Element {
  const data = createJobStatsChartData(snapshot);
  const total = calculateJobStatsTotal(snapshot);
  const max = calculateJobStatsChartMax(total, data.length);

  return (
    <Box flexDirection="column">
      <Text bold>Jobs</Text>
      <Box marginTop={1} flexDirection="column">
        {data.length ? (
          <StackedBarChart
            data={data}
            mode="absolute"
            max={max}
            width={jobStatsChartWidth}
            showLabels={false}
            showValues={false}
          />
        ) : (
          <Text dimColor>No jobs yet</Text>
        )}
        <JobStatsLegend snapshot={snapshot} />
      </Box>
    </Box>
  );
}

function createJobStatsChartData(snapshot: TerminalSessionSnapshot): StackedBarSegment[] {
  return jobStatsChartRows
    .map((row) => ({
      label: row.label,
      value: snapshot.jobCounts[row.counter],
      color: row.color,
    }))
    .filter((segment) => segment.value > 0);
}

function calculateJobStatsTotal(snapshot: TerminalSessionSnapshot): number {
  return jobStatsChartRows.reduce((total, row) => total + snapshot.jobCounts[row.counter], 0);
}

function calculateJobStatsChartMax(total: number, positiveSegmentCount: number): number {
  if (positiveSegmentCount === 0) {
    return 1;
  }

  const availableProportionalWidth = jobStatsChartWidth - positiveSegmentCount;
  return Math.ceil((total * jobStatsChartWidth) / availableProportionalWidth);
}

function JobStatsLegend({ snapshot }: { snapshot: TerminalSessionSnapshot }): React.JSX.Element {
  return (
    <Box marginTop={1} flexDirection="column">
      {jobStatsChartRows.map((row) => (
        <JobStatsLegendItem key={row.counter} count={snapshot.jobCounts[row.counter]} row={row} />
      ))}
    </Box>
  );
}

function JobStatsLegendItem({ count, row }: { count: number; row: JobStatsChartRow }): React.JSX.Element {
  return (
    <Box>
      <Box width={jobStatsLegendLabelWidth}>
        <Text color={row.color}>{row.label}</Text>
      </Box>
      <Text>{count}</Text>
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

function TerminalFooter({ snapshot }: { snapshot: TerminalSessionSnapshot }): React.JSX.Element {
  return (
    <Box paddingX={1} height={1} flexShrink={0} width="100%" backgroundColor="#111827">
      <Text bold color="#d1d5db">exclude: </Text>
      {renderDraftValue(snapshot.excludeDraft)}
    </Box>
  );
}

function renderActivityLines(recentLogs: TerminalLogEntry[]): React.JSX.Element[] {
  if (!recentLogs.length) {
    return [<Text key="empty-activity" dimColor>Waiting for events...</Text>];
  }

  return recentLogs.slice().reverse().map((log) => (
    <Text key={`${log.timestamp}-${log.message}`}>
      <Text dimColor>{log.timestamp} </Text>
      <Text color={getActivityColor(log.level)}>{getActivityBadge(log.level)} </Text>
      <Text>{log.message}</Text>
    </Text>
  ));
}

function buildSessionSummaryRows(snapshot: TerminalSessionSnapshot): SessionSummaryRow[] {
  return [
    { label: 'Phase', value: snapshot.context.phase ?? '-' },
    { label: 'Search', value: snapshot.context.searchQuery ?? '-' },
    { label: 'Location', value: String(snapshot.context.location ?? '-') },
    { label: 'Current job', value: snapshot.context.jobId ?? '-' },
    { label: 'Rules', value: `include ${snapshot.ruleCatalog.include.length} | exclude ${snapshot.ruleCatalog.exclude.length} | extra exclude ${snapshot.additionalKeywords.exclude.length}` },
  ];
}

function buildHeaderModeLabel(context: LoggerContext): string {
  return context.runMode === 'manual-review' ? 'manual review' : 'scan';
}

function renderDraftValue(draft: TerminalRuleDraft): React.JSX.Element {
  const beforeCursor = draft.value.slice(0, draft.cursorOffset);
  const afterCursor = draft.value.slice(draft.cursorOffset);

  return (
    <Text>
      <Text color="#9ca3af">{beforeCursor}</Text>
      <Text color="#e5e7eb">|</Text>
      <Text color="#9ca3af">{afterCursor}</Text>
    </Text>
  );
}

function getActivityBadge(level: TerminalLogEntry['level']): string {
  if (level === 'success') {
    return '[ok]';
  }

  if (level === 'warn') {
    return '[warn]';
  }

  if (level === 'error') {
    return '[error]';
  }

  return '[info]';
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

function handleTerminalInput(store: TerminalSessionStore, input: string, key: Key): void {
  if (key.ctrl && input === 'c') {
    process.kill(process.pid, 'SIGINT');
    return;
  }

  store.handleInput(input, toTerminalInputKey(key));
}

function toTerminalInputKey(key: Key): TerminalInputKey {
  return {
    ctrl: key.ctrl,
    downArrow: key.downArrow,
    leftArrow: key.leftArrow,
    return: key.return,
    rightArrow: key.rightArrow,
    tab: key.tab,
    upArrow: key.upArrow,
    escape: key.escape,
    backspace: key.backspace,
    delete: key.delete,
    home: key.home,
    end: key.end,
  };
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
