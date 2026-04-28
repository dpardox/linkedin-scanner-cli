import { awsKeywords } from '@keywords/exclude.keywords';
import { USCitizenshipKeywords } from '@keywords/us-citizenship.keywords';
import { golangKeywords } from '@keywords/golang.keywords';
import { javaKeywords } from '@keywords/java.keywords';
import { pythonKeywords } from '@keywords/python.keywords';
import { reactKeywords } from '@keywords/react.keywords';
import {
  angularKeywords,
  csharpKeywords,
  dotnetKeywords,
  englishKeywords,
} from '@keywords';
import { PersistedJobRule } from './persisted-job-rule.type';

const additionalExcludeKeywordRules: PersistedJobRule[] = [
  { id: 'java', name: 'Java', kind: 'keyword', terms: [...javaKeywords] },
  { id: 'python', name: 'Python', kind: 'keyword', terms: [...pythonKeywords] },
  { id: 'golang', name: 'Go', kind: 'keyword', terms: [...golangKeywords] },
  { id: 'react', name: 'React', kind: 'keyword', terms: [...reactKeywords] },
  { id: 'aws', name: 'AWS', kind: 'keyword', terms: [...awsKeywords] },
];

export const additionalExcludeKeywordRuleIds = additionalExcludeKeywordRules.map(({ id }) => id);

export const defaultPersistedJobRules: PersistedJobRule[] = [
  {
    id: 'angular',
    name: 'Angular',
    kind: 'keyword',
    terms: [...angularKeywords],
  },
  {
    id: 'csharp',
    name: 'C#',
    kind: 'keyword',
    terms: [...csharpKeywords],
  },
  {
    id: 'english',
    name: 'English',
    kind: 'keyword',
    terms: [...englishKeywords],
  },
  {
    id: 'dotnet',
    name: '.NET',
    kind: 'keyword',
    terms: [...dotnetKeywords],
  },
  ...additionalExcludeKeywordRules,
  {
    id: 'us-citizenship',
    name: 'US citizenship',
    kind: 'term',
    terms: [...USCitizenshipKeywords],
  },
];
