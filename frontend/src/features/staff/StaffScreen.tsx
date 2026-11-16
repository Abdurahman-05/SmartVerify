import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { Check, Plus, RefreshCw } from 'lucide-react-native';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingView } from '@/components/ui/LoadingView';
import { NoConnection } from '@/components/ui/NoConnection';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { formatPhone } from '@/lib/format';
import { getStaff, staffKey, type StaffMember } from '@/lib/staff';
import { colors } from '@/theme/tokens';

import { useInvites } from './invites';
import { useRoleLabel } from './roleLabel';
import { pieceRadius } from '@/features/transactions/PaymentRow';
import { useBrandColors } from '@/store/theme';
import { GlassCard, PrimaryButton, ScreenBg } from '@/ui/glass';

export function RolePill({ role }: { role: StaffMember['role'] }) {
  const roleLabel = useRoleLabel();
  const brand = useBrandColors();
  const look =
    role === 'manager'
      ? { bg: brand.primary, fg: '#FFFFFF' }
      : role === 'chef'
        ? { bg: colors.warnBg, fg: colors.warnFg }
        : { bg: brand.tile, fg: brand.primary };
  return (
    <View
      className="h-6 justify-center rounded-[12px] px-[9px]"
      style={{ backgroundColor: look.bg }}
    >
      <Text font="bold" className="text-[13px]" style={{ color: look.fg }}>
        {roleLabel(role)}
      </Text>
    </View>
  );
}

export function ActivePill({ active }: { active: boolean }) {
  const { t } = useTranslation();
  return (
    <View
      className={`flex-row items-center gap-1 rounded-[14px] py-[3px] pl-2 pr-2.5 ${active ? 'bg-successBg' : 'bg-neutralBg'}`}
    >
      {active ? <Check size={14} color={colors.successFg} strokeWidth={2.6} /> : null}
      <Text
        font="bold"
        className="text-sm"
        style={{ color: active ? colors.successFg : colors.muted }}
      >
        {active ? t('staff.active') : t('staff.inactive')}
      </Text>
    </View>
  );
}

function PinPill({ invite }: { invite?: boolean }) {
  const { t } = useTranslation();
  return (
    <View className="rounded-[14px] bg-warnBg py-[3px] pl-2 pr-2.5">
      <Text font="bold" className="text-sm" style={{ color: colors.warnFg }}>
        {invite ? t('staff.inviteSent') : t('staff.tempPin')}
      </Text>
    </View>
  );
}

/** Owner and manager: the team. Tap a person to edit, reset a forgotten PIN, or turn them on/off. */
export default function StaffScreen() {
  const { t } = useTranslation();
  const roleLabel = useRoleLabel();
  const router = useRouter();

  const query = useQuery({ queryKey: staffKey, queryFn: getStaff });
  const { refetch } = query;
  // Managers invited by email wait here (amber "Invite sent") until they accept.
  const invites = useInvites((i) => i.invites);
  const notice = useInvites((i) => i.notice);
  const clearNotice = useInvites((i) => i.clearNotice);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(clearNotice, 3500);
    return () => clearTimeout(timer);
  }, [notice, clearNotice]);
  // Lists refetch when the screen comes back into view (e.g. after adding or editing someone).
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/profile'));

  if (query.isPending) return <LoadingView screenTitle={t('staff.title')} onBack={goBack} />;
  if (query.isError && !query.data && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void refetch()} />;
  }

  const staff = [...(query.data ?? []), ...invites];
  const activeCount = staff.filter((m) => m.active).length;

  return (
    <ScreenBg>
      <SafeAreaView className="flex-1">
        <ScreenHeader
          title={t('staff.title')}
          subtitle={t('staff.people', { count: staff.length, active: activeCount })}
          onBack={goBack}
        />

        {notice ? (
          <View
            className="mx-4 mb-1 rounded-[14px] bg-successBg px-3.5 py-2.5"
            accessibilityLiveRegion="polite"
          >
            <Text font="bold" className="text-[15px]" style={{ color: colors.successFg }}>
              {notice}
            </Text>
          </View>
        ) : null}

        {query.isError ? (
          <View className="flex-1 items-center justify-center gap-4 px-6">
            <Text font="semibold" className="text-center text-lg">
              {t('staff.loadFailed')} {t(errorMessageKey(query.error))}
            </Text>
            <View className="w-full">
              <PrimaryButton
                label={t('errors.retry')}
                icon={RefreshCw}
                onPress={() => void refetch()}
              />
            </View>
          </View>
        ) : (
          <FlatList
            data={staff}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 16 }}
            renderItem={({ item, index }) => {
              const position =
                staff.length === 1
                  ? 'single'
                  : index === 0
                    ? 'first'
                    : index === staff.length - 1
                      ? 'last'
                      : 'middle';
              return (
                <GlassCard
                  // An invited manager has no account to open yet.
                  onPress={
                    item.inviteSent
                      ? undefined
                      : () => router.push({ pathname: '/staff/[id]', params: { id: item.id } })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={t('staff.rowLabel', {
                    name: item.name,
                    role: roleLabel(item.role),
                    state: item.inviteSent
                      ? t('staff.inviteSent')
                      : item.active
                        ? t('staff.active')
                        : t('staff.inactive'),
                  })}
                  radius={0}
                  className="min-h-16 flex-row items-center gap-3 px-3.5 py-2.5"
                  style={[
                    pieceRadius(position),
                    position === 'middle' || position === 'last' ? { borderTopWidth: 0 } : null,
                  ]}
                >
                  {position === 'middle' || position === 'last' ? (
                    <View className="absolute left-3.5 right-3.5 top-0 h-px bg-black/[0.07]" />
                  ) : null}
                  <View
                    className={`h-11 w-11 items-center justify-center rounded-full ${item.active ? 'bg-primaryTile' : 'bg-neutralBg'}`}
                  >
                    <Text
                      font="bold"
                      className={`text-[17px] ${item.active ? 'text-primary' : 'text-muted'}`}
                    >
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View
                    className={`min-w-0 flex-1 ${item.active || item.inviteSent ? '' : 'opacity-70'}`}
                  >
                    <Text font="bold" className="text-base" numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text tone="muted" className="text-sm" numberOfLines={1}>
                      {item.inviteSent
                        ? (item.email ?? '')
                        : item.active
                          ? `+251 ${formatPhone(item.phone)}`
                          : t('staff.inactive')}
                    </Text>
                    {item.inviteSent || item.pinIsTemporary ? (
                      <View className="mt-1 flex-row">
                        <PinPill invite={item.inviteSent} />
                      </View>
                    ) : null}
                  </View>
                  <View className={item.active || item.inviteSent ? '' : 'opacity-70'}>
                    <RolePill role={item.role} />
                  </View>
                </GlassCard>
              );
            }}
            ListEmptyComponent={
              <Text tone="muted" className="pt-8 text-center text-lg">
                {t('staff.empty')}
              </Text>
            }
          />
        )}
        <View className="px-4 pb-3 pt-1">
          <PrimaryButton
            label={t('staff.addTitle')}
            icon={Plus}
            onPress={() => router.push('/staff/add')}
          />
        </View>
      </SafeAreaView>
    </ScreenBg>
  );
}
