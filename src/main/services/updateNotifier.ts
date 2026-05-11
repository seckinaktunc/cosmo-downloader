import { Notification, shell } from 'electron';
import log from 'electron-log/main';
import { APP_ICON, APP_NAME } from '../appIdentity';
import { getReleasePageUrl } from './updateService';
import { getUpdatedNotificationBody } from './updateNotifierHelpers';

export {
  isVersionGreater,
  shouldNotifyOfUpdate,
  getUpdatedNotificationBody
} from './updateNotifierHelpers';

export function notifyOfUpdate(currentVersion: string, locale: string): void {
  if (!Notification.isSupported()) {
    log.info('[updates] Skipping post-update notification: not supported by the OS.');
    return;
  }

  const notification = new Notification({
    title: APP_NAME,
    body: getUpdatedNotificationBody(currentVersion, locale),
    icon: APP_ICON,
    silent: false
  });

  notification.on('click', () => {
    void shell.openExternal(getReleasePageUrl(currentVersion));
  });

  notification.show();
}
