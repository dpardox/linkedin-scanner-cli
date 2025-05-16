import { exec } from 'child_process';
import { Notifier } from '@interfaces/notifier.interface';

export class SoundNotificationAdapter implements Notifier {

  public notify(): void {
    exec('afplay /System/Library/Sounds/Glass.aiff');
  }

}
