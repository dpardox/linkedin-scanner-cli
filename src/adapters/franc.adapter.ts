import { franc } from 'franc';
import { LanguageCode } from '@enums/language-code.enum';
import { LangDetectorPort } from '@ports/lang-detector.port';

export class FrancAdapter implements LangDetectorPort {

  private static readonly supportedLanguageCodes = [
    LanguageCode.spanish,
    LanguageCode.english,
    LanguageCode.portuguese,
    LanguageCode.french,
    LanguageCode.german,
    LanguageCode.italian,
  ];

  detect(text: string): string {
    return franc(text, { only: FrancAdapter.supportedLanguageCodes });
  }

}
