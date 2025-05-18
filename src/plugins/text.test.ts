import { describe, expect, test } from 'vitest';
import { TextPlugin } from './text.plugin';
import { beforeEach } from 'node:test';

describe('TextPlugin', () => {

  const textPlugin = new TextPlugin();

  test('should return the normalized text', () => {
    const text = `
      Hello,  WORLD!
      áéíóú
      .NET
    `;
    const normalizedText = textPlugin.normalize(text);
    expect(normalizedText).toBe('hello world aeiou .net');
  });

  test('should return the normalized batch of text', () => {
    const texts = ['Hello, World!', 'áéíóú', '.NET'];
    const normalizedTexts = textPlugin.normalizeBatch(...texts);
    expect(normalizedTexts).toEqual(['hello world', 'aeiou', '.net']);
  });
});
