import React, { useEffect, useState } from 'react';
import { Box, Text, render, useInput } from 'ink';

type TerminalTextPromptProps = {
  title: string;
  defaultValue: string;
  onSubmit: (value: string) => void;
};

const inputActivationDelayMs = 100;
const terminalColorReset = '\u001B[0m';
const terminalGreen = '\u001B[32m';

export async function askTerminalText(title: string, defaultValue: string): Promise<string> {
  process.stdin.resume();

  return await new Promise((resolve) => {
    let inkRenderer: ReturnType<typeof render> | undefined;

    const submitValue = async (value: string) => {
      const currentInkRenderer = inkRenderer;
      const selectedValue = value.trim() || defaultValue;

      currentInkRenderer?.clear();
      currentInkRenderer?.unmount();
      await currentInkRenderer?.waitUntilExit();
      process.stdout.write(`${terminalGreen}✔${terminalColorReset} ${title}\n`);
      resolve(selectedValue);
    };

    inkRenderer = render(
      <TerminalTextPrompt
        title={title}
        defaultValue={defaultValue}
        onSubmit={submitValue}
      />,
      {
        exitOnCtrlC: false,
      },
    );
  });
}

function TerminalTextPrompt({
  title,
  defaultValue,
  onSubmit,
}: TerminalTextPromptProps): React.JSX.Element {
  const [value, setValue] = useState(defaultValue);
  const [cursorOffset, setCursorOffset] = useState(defaultValue.length);
  const [acceptingInput, setAcceptingInput] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setAcceptingInput(true);
    }, inputActivationDelayMs);

    return () => {
      clearTimeout(timeout);
    };
  }, []);

  useInput((input, key) => {
    if (!acceptingInput) {
      return;
    }

    if (key.ctrl && input === 'c') {
      process.kill(process.pid, 'SIGINT');
      return;
    }

    if (key.return) {
      onSubmit(value);
      return;
    }

    if (key.leftArrow) {
      setCursorOffset((offset) => Math.max(0, offset - 1));
      return;
    }

    if (key.rightArrow) {
      setCursorOffset((offset) => Math.min(value.length, offset + 1));
      return;
    }

    if (key.backspace || key.delete) {
      deleteCharacterBeforeCursor();
      return;
    }

    if (!input || key.ctrl) {
      return;
    }

    insertInput(input);
  });

  const deleteCharacterBeforeCursor = () => {
    if (cursorOffset === 0) return;

    const nextValue = `${value.slice(0, cursorOffset - 1)}${value.slice(cursorOffset)}`;
    setValue(nextValue);
    setCursorOffset(cursorOffset - 1);
  };

  const insertInput = (input: string) => {
    const nextValue = `${value.slice(0, cursorOffset)}${input}${value.slice(cursorOffset)}`;
    setValue(nextValue);
    setCursorOffset(cursorOffset + input.length);
  };

  return (
    <Box flexDirection="column">
      <Text><Text color="yellow">›</Text> <Text bold>{title}</Text></Text>
      <Text>
        <Text>{value.slice(0, cursorOffset)}</Text>
        <Text color="cyan">|</Text>
        <Text>{value.slice(cursorOffset)}</Text>
      </Text>
      <Text dimColor>Type a value, or press Enter to keep current.</Text>
    </Box>
  );
}
