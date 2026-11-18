import { Linking, Share } from 'react-native';

/** The one place for support contact details. Replace with the real ones before release. */
export const SUPPORT = {
  phone: '+251900000000',
  telegram: 'https://t.me/gebtual_support',
} as const;

export const callSupport = () => void Linking.openURL(`tel:${SUPPORT.phone}`).catch(() => {});
export const telegramSupport = () => void Linking.openURL(SUPPORT.telegram).catch(() => {});

/** Opens the receipt text in the phone's share sheet. */
export const shareReceipt = (lines: (string | null | undefined | false)[]) =>
  void Share.share({ message: lines.filter(Boolean).join('\n') }).catch(() => {});
