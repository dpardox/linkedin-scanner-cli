import { beforeEach, describe, expect, test } from 'vitest';
import { FrancAdapter } from './franc.adapter';

describe('FrancAdapter', () => {
  let franc: FrancAdapter;

  beforeEach(() => {
    franc = new FrancAdapter();
  });

  test('should detect "eng" language', () => {
    const text = 'Hello, my name is Donovan and I am currently looking for new job opportunities in the field of software development.';
    const result = franc.detect(text);
    expect(result).toBe('eng');
  });

  test('should detect "spa" language', () => {
    const text = 'Hola, me llamo Donovan y estoy buscando nuevas oportunidades laborales como desarrollador web.';
    const result = franc.detect(text);
    expect(result).toBe('spa');
  });

  test('should return empty string for empty text', () => {
    const text = '';
    const result = franc.detect(text);
    expect(result).toBe('und');
  });

});
