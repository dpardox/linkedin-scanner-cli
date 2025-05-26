import { describe, expect, test } from 'vitest';
import { matchWholeWord } from './match-whole-word.util';

describe('matchWholeWords', () => {

  test('should match whole words', () => {
    const text = `strong proficiency in javascript and typescript.`;
    const word = 'in javascript';
    const result = matchWholeWord(text, word);
    expect(result).toBe(true);
  });

  test('should not match partial words', () => {
    const text = `strong proficiency in javascript and typescript.`;
    const word = 'java';
    const result = matchWholeWord(text, word);
    expect(result).toBe(false);
  });

  test('should match words with special characters', () => {
    const text = `strong proficiency in .NET.`;
    const word = 'in .NET';
    const result = matchWholeWord(text, word);
    expect(result).toBe(true);
  });

});
