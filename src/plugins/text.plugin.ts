import { Text } from '@interfaces/text.interface';

export class TextPlugin implements Text {

  public normalize(text: string): string {
    text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    text = text.replace(/[/!,]/g, ' ');
    text = text.replace(/[\s\n\r\t]+/g, ' ').trim();
    return text.toLowerCase();
  }

  public normalizeBatch(...args: string[]): string[] {
    return args.map(text => this.normalize(text));
  }

}
