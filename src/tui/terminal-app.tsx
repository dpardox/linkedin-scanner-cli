import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Box, Text, useInput, type Key } from 'ink';
import { LoggerContext } from '@ports/logger.port';
import {
  TerminalInputKey,
  TerminalLogEntry,
  TerminalRuleDraft,
  TerminalSessionSnapshot,
  TerminalSessionStore,
} from '@tui/terminal-session.store';

type InkTerminalAppProps = {
  store: TerminalSessionStore;
};

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
        <Text>Link: {manualReviewState.job.link}</Text>
      </Box>
      <Box marginTop={2}>
        <SessionSummary snapshot={snapshot} />
      </Box>
      <Box marginTop={2} flexDirection="column">
        <Text dimColor>Recent activity</Text>
        {renderActivityLines(snapshot.recentLogs)}
      </Box>
    </Box>
  );
}

function RunningView({ snapshot }: { snapshot: TerminalSessionSnapshot }): React.JSX.Element {
  return (
    <Box flexDirection="column">
      <Text bold color="cyan">LinkedIn scanner is running.</Text>
      <Box marginTop={2}>
        <SessionSummary snapshot={snapshot} />
      </Box>
      <Box marginTop={2} flexDirection="column">
        <Text dimColor>Recent activity</Text>
        {renderActivityLines(snapshot.recentLogs)}
      </Box>
    </Box>
  );
}

function SessionSummary({ snapshot }: { snapshot: TerminalSessionSnapshot }): React.JSX.Element {
  return (
    <Box flexDirection="column">
      <Text bold>Session</Text>
      <Box marginTop={1} flexDirection="column">
        {buildSessionSummaryLines(snapshot).map((line) => (
          <Text key={line} dimColor>{line}</Text>
        ))}
      </Box>
    </Box>
  );
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

function buildSessionSummaryLines(snapshot: TerminalSessionSnapshot): string[] {
  return [
    `Phase: ${snapshot.context.phase ?? '-'}`,
    `Search: ${snapshot.context.searchQuery ?? '-'}`,
    `Location: ${snapshot.context.location ?? '-'}`,
    `Current job: ${snapshot.context.jobId ?? '-'}`,
    `Rules: include ${snapshot.ruleCatalog.include.length} · exclude ${snapshot.ruleCatalog.exclude.length}`,
    `Found ${snapshot.jobCounts.found} · Unknown ${snapshot.jobCounts.undetermined} · Discarded ${snapshot.jobCounts.discarded} · Skipped ${snapshot.jobCounts.skipped}`,
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
