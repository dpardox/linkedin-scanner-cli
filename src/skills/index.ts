import { Keywords } from '@shared/types/keywords';

export type SkillKeywords = ReadonlyArray<string>;

export function mergeKeywordGroups(...groups: Array<SkillKeywords | undefined>): string[] {
  return Array.from(
    new Set(
      groups
        .flatMap(group => group ?? [])
        .filter((keyword): keyword is string => Boolean(keyword?.trim())),
    ),
  );
}

type CreateKeywordsParams = {
  includeSkills?: SkillKeywords[];
  excludeSkills?: SkillKeywords[];
  includeKeywords?: string[];
  excludeKeywords?: string[];
};

export function createKeywords({
  includeSkills = [],
  excludeSkills = [],
  includeKeywords = [],
  excludeKeywords = [],
}: CreateKeywordsParams = {}): Keywords {
  return {
    include: mergeKeywordGroups(...includeSkills, includeKeywords),
    exclude: mergeKeywordGroups(...excludeSkills, excludeKeywords),
  };
}

export { angularSkillKeywords } from './angular.skill';
export { csharpSkillKeywords } from './csharp.skill';
export { cplusplusSkillKeywords } from './cplusplus.skill';
export { dotnetSkillKeywords } from './dotnet.skill';
export { englishSkillKeywords } from './english.skill';
export { phpSkillKeywords } from './php.skill';
