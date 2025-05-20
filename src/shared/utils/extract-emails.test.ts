import { describe, expect, test } from 'vitest';
import { extractEmails } from './extract-emails.util';

describe('extractEmails', () => {

  test('should extract email from string', () => {
    const text = 'Please send an email to hiring@company.com for more information.';
    const result = extractEmails(text);
    expect(result).toEqual(['hiring@company.com']);
  });

});
