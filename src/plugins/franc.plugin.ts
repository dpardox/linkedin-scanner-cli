import { franc } from 'franc';
import { LangDetector } from '@interfaces/lang-detector.interface';

export class FrancPlugin implements LangDetector {

  detect(text: string): string {
    const language = franc(text);
    return language;
  }

}
