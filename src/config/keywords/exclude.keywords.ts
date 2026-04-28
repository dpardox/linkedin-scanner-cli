import { fluentEnglishKeywords } from './fluent-english.keywords';
import { javaKeywords } from './java.keywords';
import { dotnetKeywords } from './dotnet.keywords';
import { pythonKeywords } from './python.keywords';
import { reactKeywords } from './react.keywords';
import { golangKeywords } from './golang.keywords';
import { mergeKeywordGroups } from '@keywords';

export const awsKeywords = [
  'years of hands-on AWS experience',
  'CLOUD ENGINEERING',
].filter(Boolean);

export const additionalExcludeKeywords = mergeKeywordGroups(
  javaKeywords,
  pythonKeywords,
  golangKeywords,
  reactKeywords,
  awsKeywords,
);

export const excludeKeywords = mergeKeywordGroups(
  fluentEnglishKeywords,
  dotnetKeywords,
  additionalExcludeKeywords,
);
