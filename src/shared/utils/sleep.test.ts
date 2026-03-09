import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { sleep } from './sleep.util';

describe('sleep', () => {

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('should resolve after the specified time', async () => {
    const sleepPromise = sleep(1000);

    await vi.advanceTimersByTimeAsync(1000);

    await expect(sleepPromise).resolves.toBeUndefined();
  });

  test('should resolve immediately if time is 0', async () => {
    const sleepPromise = sleep(0);

    await vi.advanceTimersByTimeAsync(0);

    await expect(sleepPromise).resolves.toBeUndefined();
  });

});
