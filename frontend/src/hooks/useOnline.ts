import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

/** true while the phone has internet (Wi-Fi or mobile data); follows changes. */
export const useOnline = () =>
  useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline()
  );
