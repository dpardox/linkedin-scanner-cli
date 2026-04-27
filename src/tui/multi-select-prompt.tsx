import React, { useEffect, useState } from 'react';
import { Box, Text, render, useInput } from 'ink';

export type TerminalMultiSelectOption<T extends string> = {
  label: string;
  value: T;
};

type TerminalMultiSelectPromptProps<T extends string> = {
  title: string;
  options: Array<TerminalMultiSelectOption<T>>;
  selectedValues: T[];
  multiple?: boolean;
  limit?: number;
  onSubmit: (values: T[]) => void;
};

type ListedItem = {
  label: string;
  value: string;
};

const inputActivationDelayMs = 100;
const terminalColorReset = '\u001B[0m';
const terminalGreen = '\u001B[32m';

export async function selectTerminalOptions<T extends string>({
  title,
  options,
  selectedValues,
  multiple = true,
  limit = 12,
}: Omit<TerminalMultiSelectPromptProps<T>, 'onSubmit'>): Promise<T[]> {
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
  options,
  selectedValues,
  multiple = true,
  limit,
  onSubmit,
}: TerminalMultiSelectPromptProps<T>): React.JSX.Element {
  const items = options.map((option) => ({
    label: option.label,
    value: option.value,
  }));
  const [selectedItems, setSelectedItems] = useState<ListedItem[]>(() => selectItems(items, selectedValues));
  const [highlightedIndex, setHighlightedIndex] = useState(0);
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

    if (key.upArrow || input === 'k') {
      setHighlightedIndex((index) => moveHighlightedIndex(index, items.length, -1));
      return;
    }

    if (key.downArrow || input === 'j') {
      setHighlightedIndex((index) => moveHighlightedIndex(index, items.length, 1));
      return;
    }

    if (input === ' ') {
      const item = items[highlightedIndex];
      setSelectedItems((currentItems) => toggleSelectedItem(currentItems, item, multiple));
      return;
    }

    if (key.return) {
      onSubmit(selectedItems.map((item) => String(item.value) as T));
    }
  });

  return (
    <Box flexDirection="column">
      <Text><Text color="yellow">›</Text> <Text bold>{title}</Text></Text>
      {visibleItems(items, highlightedIndex, limit).map((item) => (
        <Box key={item.value}>
          <Box marginRight={1}>
            <Text color={isHighlighted(items, item, highlightedIndex) ? 'blue' : undefined}>
              {isHighlighted(items, item, highlightedIndex) ? '›' : ' '}
            </Text>
          </Box>
          <Box marginRight={1}>
            <Text color="green">{isSelected(selectedItems, item) ? '◉' : '○'}</Text>
          </Box>
          <Text color={isHighlighted(items, item, highlightedIndex) ? 'blue' : undefined}>{item.label}</Text>
        </Box>
      ))}
      <Text dimColor>Use arrows to move, Space to toggle, Enter to continue.</Text>
    </Box>
  );
}

function visibleItems(items: ListedItem[], highlightedIndex: number, limit = items.length): ListedItem[] {
  if (items.length <= limit) return items;

  const firstVisibleIndex = highlightedIndex < limit
    ? 0
    : Math.min(highlightedIndex - limit + 1, items.length - limit);
  return items.slice(firstVisibleIndex, firstVisibleIndex + limit);
}

function moveHighlightedIndex(currentIndex: number, itemsLength: number, offset: number): number {
  const nextIndex = currentIndex + offset;
  if (nextIndex < 0) return itemsLength - 1;
  if (nextIndex >= itemsLength) return 0;

  return nextIndex;
}

function selectItems<T extends string>(items: ListedItem[], selectedValues: T[]): ListedItem[] {
  return items.filter((item) => selectedValues.includes(String(item.value) as T));
}

function toggleSelectedItem(items: ListedItem[], item: ListedItem, multiple: boolean): ListedItem[] {
  if (isSelected(items, item)) {
    return unselectItem(items, item);
  }

  if (!multiple) {
    return [item];
  }

  return [...items, item];
}

function isHighlighted(items: ListedItem[], item: ListedItem, highlightedIndex: number): boolean {
  return items[highlightedIndex].value === item.value;
}

function isSelected(items: ListedItem[], item: ListedItem): boolean {
  return items.some(({ value }) => value === item.value);
}

function unselectItem(items: ListedItem[], item: ListedItem): ListedItem[] {
  return items.filter(({ value }) => value !== item.value);
}
