import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { AlertTriangle, Megaphone } from 'lucide-react-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { getBusinessAccess, getBusinessAnnouncements } from '@/lib/business';
import { useSession } from '@/store/session';
import { colors } from '@/theme/tokens';

/**
 * Top of the home page: the payment warning (trial ending, overdue, restricted, paused) with
 * "Pay now" for the owner, and announcements from the Smart Verify team.
 */
export function AccessBanner() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const isOwner = useSession((s) => s.user?.role === 'owner');
  const access = useQuery({ queryKey: ['business-access'], queryFn: getBusinessAccess });
  const news = useQuery({
    queryKey: ['business-announcements'],
    queryFn: getBusinessAnnouncements,
  });
  const { refetch: refetchAccess } = access;
  const { refetch: refetchNews } = news;
  useFocusEffect(
    useCallback(() => {
      void refetchAccess();
      void refetchNews();
    }, [refetchAccess, refetchNews])
  );

  const a = access.data;
  const days = Math.max(0, a?.daysLeft ?? 0);
  // Days until the next step (grace → restricted), for the grace message.
  const daysToNext =
    a?.nextStepAt && a.endsAt
      ? Math.max(
          0,
          Math.round((Date.parse(a.nextStepAt) - Date.parse(a.endsAt)) / 86_400_000) +
            (a.daysLeft ?? 0)
        )
      : 0;
  const message = !a
    ? null
    : a.status === 'suspended'
      ? t(a.suspendedByAdmin ? 'business.access.suspendedAdmin' : 'business.access.suspended')
      : a.status === 'restricted'
        ? t('business.access.restricted')
        : a.status === 'grace'
          ? t('business.access.grace', { count: daysToNext })
          : a.remind
            ? t(a.status === 'trial' ? 'business.access.trial' : 'business.access.remind', {
                count: days,
              })
            : null;
  const serious = a?.status === 'restricted' || a?.status === 'suspended' || a?.status === 'grace';
  const canPay = isOwner && !(a?.status === 'suspended' && a.suspendedByAdmin);

  if (!message && !news.data?.length) return null;
  return (
    <View className="gap-2.5 px-4 pt-2">
      {message ? (
        <View
          className={`flex-row items-center gap-3 rounded-2xl px-4 py-3 ${serious ? 'bg-dangerBg' : 'bg-warnBg'}`}
          accessibilityRole="alert"
        >
          <AlertTriangle
            size={22}
            color={serious ? colors.dangerFg : colors.warnFg}
            strokeWidth={2.2}
          />
          <Text
            font="semibold"
            className={`flex-1 text-[15px] ${serious ? 'text-dangerFg' : 'text-warnFg'}`}
          >
            {message}
          </Text>
          {canPay ? (
            <Pressable
              onPress={() => router.push('/subscription')}
              accessibilityRole="button"
              className="h-11 justify-center rounded-[22px] bg-primary px-4"
            >
              <Text font="bold" tone="inverse" className="text-sm">
                {t('business.access.pay')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {news.data?.map((n) => (
        <View
          key={n.id}
          className="flex-row items-center gap-3 rounded-2xl bg-primarySoft px-4 py-3"
        >
          <Megaphone size={20} color={colors.primary} strokeWidth={2.2} />
          <Text className="flex-1 text-[15px]">{i18n.language === 'am' ? n.bodyAm : n.bodyEn}</Text>
        </View>
      ))}
    </View>
  );
}
