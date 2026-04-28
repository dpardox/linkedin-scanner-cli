import { describe, expect, test } from 'vitest';
import { defaultPersistedJobRules, additionalExcludeKeywordRuleIds } from './default-persisted-job-rules';

describe('defaultPersistedJobRules', () => {

  test('should classify additional keywords as selectable keyword rules', () => {
    const rulesById = new Map(defaultPersistedJobRules.map((rule) => [rule.id, rule]));

    expect(additionalExcludeKeywordRuleIds).toContain('java');
    expect(additionalExcludeKeywordRuleIds).toContain('react');
    expect(additionalExcludeKeywordRuleIds).toContain('aws');
    expect(rulesById.get('java')?.kind).toBe('keyword');
    expect(rulesById.get('react')?.kind).toBe('keyword');
    expect(rulesById.get('aws')?.kind).toBe('keyword');
    expect(rulesById.get('us-citizenship')?.kind).toBe('term');
    expect(rulesById.get('us-citizenship')?.terms).toContain('MUST BE A US CITIZEN');
  });

});
