import { describe, expect, test } from 'vitest';
import { sleep } from './sleep.util';

describe('sleep', () => {

  test('should resolve after the specified time', async () => {
    const start = Date.now();
    await sleep(1000);
    const end = Date.now();
    expect(end - start).toBeGreaterThanOrEqual(1000);
  });

  test('should resolve immediately if time is 0', async () => {
    const start = Date.now();
    await sleep(0);
    const end = Date.now();
    expect(end - start).toBeLessThan(10);
  });

});
