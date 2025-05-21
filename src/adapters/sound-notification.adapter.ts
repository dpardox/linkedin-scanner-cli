import { exec } from 'child_process';
import { NotifierPort } from '@ports/notifier.port';

export class SoundNotificationAdapter implements NotifierPort {

  public notify(): void {
    exec('afplay /System/Library/Sounds/Glass.aiff');
  }

}
