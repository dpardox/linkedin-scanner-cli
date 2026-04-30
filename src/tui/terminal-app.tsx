import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Box, Text, useInput, type Key } from 'ink';
import { TextInput } from '@inkjs/ui';
import Link from 'ink-link';
import { Spawn } from 'ink-spawn';
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
    { label: 'Rules', value: `include rules ${snapshot.ruleCatalog.include.length} | exclusion rules ${snapshot.ruleCatalog.exclude.length} | custom exclusions ${snapshot.additionalKeywords.exclude.length}` },
  ];
}

function buildHeaderModeLabel(context: LoggerContext): string {
  return context.runMode === 'manual-review' ? 'manual review' : 'scan';
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
