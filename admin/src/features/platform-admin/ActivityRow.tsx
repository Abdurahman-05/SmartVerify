import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import type { ActivityItem } from '@/lib/admin';

/** "Windows · Chrome" from a user agent, without the noise. */
function device(userAgent: string | null): string {
  if (!userAgent) return '';
  const os = /Windows/.test(userAgent)
    ? 'Windows'
    : /Android/.test(userAgent)
      ? 'Android'
      : /iPhone|iPad/.test(userAgent)
        ? 'iOS'
        : /Mac OS/.test(userAgent)
          ? 'macOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : '';
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Chrome\//.test(userAgent)
      ? 'Chrome'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : '';
  return [os, browser].filter(Boolean).join(' · ');
}

/** One activity log line: when, who, what, and for which customer. */
export function ActivityRow({ item }: { item: ActivityItem }) {
  const { t, i18n } = useTranslation();
  const when = new Date(item.createdAt).toLocaleString(i18n.language === 'am' ? 'am-ET' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const what = t(`platformAdmin.actions.${item.action}`, { defaultValue: item.action });
  const failed = item.action.endsWith('_failed');
  const locked = item.details?.locked === true;
  const extra = [device(item.userAgent), item.ip].filter(Boolean).join(' · ');

  return (
    <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1 border-t-[1.5px] border-divider py-3.5">
      <Text tone="muted" className="w-[130px] text-[15px]">
        {when}
      </Text>
      <Text font="semibold" className="w-[150px] text-[15px]" numberOfLines={1}>
        {item.adminName ?? t('platformAdmin.activity.unknown')}
      </Text>
      <View className="min-w-[220px] flex-1">
        <Text
          font={failed ? 'bold' : 'body'}
          className={`text-[15px] ${failed ? 'text-dangerFg' : ''}`}
        >
          {what}
          {locked ? ` · ${t('platformAdmin.locked')}` : ''}
        </Text>
        {extra ? (
          <Text tone="muted" className="text-sm">
            {extra}
          </Text>
        ) : null}
      </View>
      <Text className="w-[160px] text-[15px]" numberOfLines={1}>
        {item.businessName ?? '–'}
      </Text>
    </View>
  );
}
