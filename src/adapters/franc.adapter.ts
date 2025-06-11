import { franc } from 'franc';
import { LangDetectorPort } from '@ports/lang-detector.port';

export class FrancAdapter implements LangDetectorPort {

  detect(text: string): string {
    return franc(text, { only: [ 'spa', 'eng', 'por', 'fra' ] });
  }

}
