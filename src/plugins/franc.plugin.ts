import { franc } from 'franc';
import { Language } from '../interfaces/language.interface';

export class FrancPlugin implements Language {

  detect(text: string): string {
    const language = franc(text); // TODO (dpardo): translate eng to english and spa to spanish ...
    if (language === 'und') return '';
    return language;
  }

}
