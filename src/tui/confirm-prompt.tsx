import React, { useEffect, useState } from 'react';
import { Box, Text, render, useInput } from 'ink';
import { ConfirmInput } from '@inkjs/ui';

type TerminalConfirmPromptProps = {
  title: string;
  detail: string;
  defaultValue: boolean;
  onSubmit: (value: boolean) => void;
};

const inputActivationDelayMs = 100;
const terminalColorReset = '\u001B[0m';
const terminalGreen = '\u001B[32m';

export async function askTerminalConfirmation(
  title: string,
  detail: string,
  defaultValue: boolean,
): Promise<boolean> {
  process.stdin.resume();

  return await new Promise((resolve) => {
    let inkRenderer: ReturnType<typeof render> | undefined;

    const submitValue = async (value: boolean) => {
      const currentInkRenderer = inkRenderer;

      currentInkRenderer?.clear();
      currentInkRenderer?.unmount();
      await currentInkRenderer?.waitUntilExit();
      process.stdout.write(`${terminalGreen}✔${terminalColorReset} ${title}\n`);
      resolve(value);
    };

    inkRenderer = render(
      <TerminalConfirmPrompt
        title={title}
        detail={detail}
        defaultValue={defaultValue}
        onSubmit={submitValue}
      />,
      {
        exitOnCtrlC: false,
      },
    );
  });
}

function TerminalConfirmPrompt({
  title,
  detail,
  defaultValue,
  onSubmit,
}: TerminalConfirmPromptProps): React.JSX.Element {
  const [acceptingInput, setAcceptingInput] = useState(false);

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      process.kill(process.pid, 'SIGINT');
    }
  });

  useEffect(() => {
    const timeout = setTimeout(() => {
      setAcceptingInput(true);
    }, inputActivationDelayMs);

    return () => {
      clearTimeout(timeout);
    };
  }, []);

  return (
    <Box flexDirection="column">
      <Text><Text color="yellow">›</Text> <Text bold>{title}</Text></Text>
      <ConfirmInput
        isDisabled={!acceptingInput}
        defaultChoice={defaultValue ? 'confirm' : 'cancel'}
        onConfirm={() => {
          onSubmit(true);
        }}
        onCancel={() => {
          onSubmit(false);
        }}
      />
      <Text dimColor>({detail})</Text>
    </Box>
  );
}
