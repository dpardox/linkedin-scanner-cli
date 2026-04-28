export type JobRuleScope = 'include' | 'exclude';

export type PersistedJobRuleKind = 'keyword' | 'term';

export type PersistedJobRule = {
  id: string;
  name: string;
  kind: PersistedJobRuleKind;
  terms: string[];
};

export type PersistedJobRuleSelection = {
  includeRuleIds?: string[];
  excludeRuleIds?: string[];
  includeKeywords?: string[];
  excludeKeywords?: string[];
};
