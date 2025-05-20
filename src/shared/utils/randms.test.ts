import { describe, expect, test, vi } from 'vitest';
import { randms } from './randms.util';

describe('randms', () => {

  test('should return a number between 500 and 1000', () => {
    const result = randms();
    expect(result).toBeGreaterThanOrEqual(500);
    expect(result).toBeLessThanOrEqual(1000);
  });

  test('should return a number between 1000 and 2000', () => {
    const result = randms(1, 2);
    expect(result).toBeGreaterThanOrEqual(1000);
    expect(result).toBeLessThanOrEqual(2000);
  });

  test('should return a number between 0 and 1000', () => {
    const result = randms(0, 1);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1000);
  });

  test('should return a number between 5000 and 6000', () => {
    const result = randms(5, 6);
    expect(result).toBeGreaterThanOrEqual(5000);
    expect(result).toBeLessThanOrEqual(6000);
  });

  test('should return a number between 300 and 900', () => {
    const result = randms(.3, .9);
    expect(result).toBeGreaterThanOrEqual(300);
    expect(result).toBeLessThanOrEqual(900);
  });

  test('should return a number between 500 and 600', () => {
    const result = randms(.5, .6);
    expect(result).toBeGreaterThanOrEqual(500);
    expect(result).toBeLessThanOrEqual(600);
  });

  test('should return 1250 when Math.random is .25 and form 1 and to 2', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.25);

    const result = randms(1, 2);
    expect(result).toBe(1250);

    vi.spyOn(Math, 'random').mockRestore();
  });

});
