import React, { useEffect, useState } from 'react';
import { Box, Text, render, useInput } from 'ink';
import { MultiSelect } from '@inkjs/ui';

export type TerminalMultiSelectOption<T extends string> = {
  label: string;
  value: T;
};

type TerminalMultiSelectPromptProps<T extends string> = {
  title: string;
  detail: string;
  options: Array<TerminalMultiSelectOption<T>>;
  selectedValues: T[];
  multiple?: boolean;
  limit?: number;
  onSubmit: (values: T[]) => void;
};

const inputActivationDelayMs = 100;
const terminalColorReset = '\u001B[0m';
const terminalGreen = '\u001B[32m';
const defaultMultiSelectPromptDetail = 'Use arrows to move, Space to toggle, Enter to continue.';

export async function selectTerminalOptions<T extends string>({
  title,
  detail = defaultMultiSelectPromptDetail,
  options,
  selectedValues,
  multiple = true,
  limit = 12,
}: Omit<TerminalMultiSelectPromptProps<T>, 'onSubmit' | 'detail'> & { detail?: string }): Promise<T[]> {
  process.stdin.resume();

  return await new Promise((resolve) => {
    let inkRenderer: ReturnType<typeof render> | undefined;

    const submitSelection = async (values: T[]) => {
      const selectedOptionValues = values.length ? values : selectedValues;
      const currentInkRenderer = inkRenderer;
      currentInkRenderer?.clear();
      currentInkRenderer?.unmount();
      await currentInkRenderer?.waitUntilExit();
      process.stdout.write(`${terminalGreen}✔${terminalColorReset} ${title}\n`);
      resolve(selectedOptionValues);
    };

    inkRenderer = render(
      <TerminalMultiSelectPrompt
        title={title}
        detail={detail}
        options={options}
        selectedValues={selectedValues}
        multiple={multiple}
        limit={limit}
        onSubmit={submitSelection}
      />,
      {
        exitOnCtrlC: false,
      },
    );
  });
}

function TerminalMultiSelectPrompt<T extends string>({
  title,
  detail,
  options,
  selectedValues,
  multiple = true,
  limit,
  onSubmit,
}: TerminalMultiSelectPromptProps<T>): React.JSX.Element {
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [acceptingInput, setAcceptingInput] = useState(false);
  const [singleSelectedValues, setSingleSelectedValues] = useState(selectedValues);
  const optionValues = options.map((option) => option.value);

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

    if (!multiple && key.upArrow) {
      setHighlightedIndex((index) => moveHighlightedIndex(index, optionValues.length, -1));
    }

    if (!multiple && key.downArrow) {
      setHighlightedIndex((index) => moveHighlightedIndex(index, optionValues.length, 1));
    }
  });

  const handleChange = (values: string[]) => {
    if (multiple) return;

    setSingleSelectedValues(selectSingleValue(values, singleSelectedValues, optionValues, highlightedIndex) as T[]);
    setHighlightedIndex(0);
  };

  const handleSubmit = (values: string[]) => {
    const submittedValues = multiple
      ? values
      : selectSingleValue(values, singleSelectedValues, optionValues, highlightedIndex);

    if (submittedValues.length) {
      onSubmit(submittedValues as T[]);
      return;
    }

    onSubmit(selectedValues);
  };

  return (
    <Box flexDirection="column">
      <Text><Text color="yellow">›</Text> <Text bold>{title}</Text></Text>
      <MultiSelect
        key={multiple ? 'multiple' : singleSelectedValues.join(',')}
        isDisabled={!acceptingInput}
        visibleOptionCount={limit}
        options={options}
        defaultValue={multiple ? selectedValues : singleSelectedValues}
        onChange={handleChange}
        onSubmit={handleSubmit}
      />
      <Text dimColor>({detail})</Text>
    </Box>
  );
}

function moveHighlightedIndex(currentIndex: number, itemsLength: number, offset: number): number {
  const nextIndex = currentIndex + offset;
  if (nextIndex < 0) return 0;
  if (nextIndex >= itemsLength) return itemsLength - 1;

  return nextIndex;
}

function selectSingleValue<T extends string>(
  values: string[],
  previousValues: T[],
  optionValues: T[],
  highlightedIndex: number,
): T[] {
  const newValue = values.find((value) => !previousValues.includes(value as T));
  if (newValue) return [newValue as T];

  const highlightedValue = optionValues[highlightedIndex];
  if (highlightedValue && values.includes(highlightedValue)) return [highlightedValue];

  return values.slice(-1) as T[];
}
