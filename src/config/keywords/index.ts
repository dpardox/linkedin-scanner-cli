import { Keywords } from '@shared/types/keywords';

export type KeywordGroup = ReadonlyArray<string>;

export function mergeKeywordGroups(...groups: Array<KeywordGroup | undefined>): string[] {
  return Array.from(
    new Set(
      groups
        .flatMap((group) => group ?? [])
        .filter((keyword): keyword is string => Boolean(keyword?.trim())),
    ),
  );
}

type CreateKeywordsParams = {
  includeKeywordGroups?: KeywordGroup[];
  excludeKeywordGroups?: KeywordGroup[];
  includeKeywords?: string[];
  excludeKeywords?: string[];
};

export function createKeywords({
  includeKeywordGroups = [],
  excludeKeywordGroups = [],
  includeKeywords = [],
  excludeKeywords = [],
}: CreateKeywordsParams = {}): Keywords {
  return {
    include: mergeKeywordGroups(...includeKeywordGroups, includeKeywords),
    exclude: mergeKeywordGroups(...excludeKeywordGroups, excludeKeywords),
  };
}

export { angularKeywords } from './angular.keywords';
export { csharpKeywords } from './csharp.keywords';
export { dotnetKeywords } from './dotnet.keywords';
export { englishKeywords } from './english.keywords';
