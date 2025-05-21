import { describe, expect, test, vi } from 'vitest';
import { SoundNotificationAdapter } from './sound-notification.adapter';
import { exec } from 'child_process';

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

describe('SoundNotificationAdapter', () => {
  test('should call exec with the correct sound command', () => {
    const adapter = new SoundNotificationAdapter();
    adapter.notify();

    expect(exec).toHaveBeenCalledWith('afplay /System/Library/Sounds/Glass.aiff');
  });
});
