import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { Check, ChevronRight, Plus, RefreshCw } from 'lucide-react-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { LoadingView } from '@/components/ui/LoadingView';
import { NoConnection } from '@/components/ui/NoConnection';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { formatPhone } from '@/lib/format';
import { getStaff, staffKey, type StaffMember } from '@/lib/staff';
import { colors } from '@/theme/tokens';

import { useRoleLabel } from './roleLabel';

export function RolePill({ role }: { role: StaffMember['role'] }) {
  const roleLabel = useRoleLabel();
  const isManager = role === 'manager';
  return (
    <View
      className={`rounded-[14px] py-[3px] pl-2 pr-2.5 ${isManager ? 'bg-text' : 'bg-successBg'}`}
    >
      <Text
        font="bold"
        className="text-sm"
        style={{ color: isManager ? colors.surface : colors.successFg }}
      >
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

function PinPill() {
  const { t } = useTranslation();
  return (
    <View className="rounded-[14px] bg-warnBg py-[3px] pl-2 pr-2.5">
      <Text font="bold" className="text-sm" style={{ color: colors.warnFg }}>
        {t('staff.tempPin')}
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

  const staff = query.data ?? [];
  const activeCount = staff.filter((m) => m.active).length;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader
        title={t('staff.title')}
        subtitle={t('staff.people', { count: staff.length, active: activeCount })}
        onBack={goBack}
        right={
          <Pressable
            onPress={() => router.push('/staff/add')}
            accessibilityRole="button"
            accessibilityLabel={t('staff.addTitle')}
            className="h-11 flex-row items-center gap-1 rounded-[22px] bg-primary pl-3 pr-4 active:opacity-80"
          >
            <Plus size={20} color={colors.surface} strokeWidth={2.8} />
            <Text font="bold" tone="inverse" className="text-base">
              {t('staff.add')}
            </Text>
          </Pressable>
        }
      />

      {query.isError ? (
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text font="semibold" className="text-center text-lg">
            {t('staff.loadFailed')} {t(errorMessageKey(query.error))}
          </Text>
          <View className="w-full">
            <Button label={t('errors.retry')} icon={RefreshCw} onPress={() => void refetch()} />
          </View>
        </View>
      ) : (
        <FlatList
          data={staff}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{
            gap: 8,
            paddingHorizontal: 16,
            paddingTop: 6,
            paddingBottom: 16,
          }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/staff/[id]', params: { id: item.id } })}
              accessibilityRole="button"
              accessibilityLabel={t('staff.rowLabel', {
                name: item.name,
                role: roleLabel(item.role),
                state: item.active ? t('staff.active') : t('staff.inactive'),
              })}
              className={`flex-row items-center gap-3 rounded-[18px] border-[1.5px] border-border bg-surface px-3 py-2.5 active:bg-background ${
                item.active ? '' : 'opacity-80'
              }`}
            >
              <View
                className={`h-12 w-12 items-center justify-center rounded-full ${item.active ? 'bg-primary' : 'bg-borderStrong'}`}
              >
                <Text font="bold" tone="inverse" className="text-xl">
                  {item.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View className="min-w-0 flex-1">
                <Text font="bold" className="text-[17px]" numberOfLines={1}>
                  {item.name}
                </Text>
                <Text tone="muted" className="text-sm">
                  +251 {formatPhone(item.phone)}
                </Text>
                <View className="mt-1 flex-row flex-wrap gap-1.5">
                  <RolePill role={item.role} />
                  <ActivePill active={item.active} />
                  {item.pinIsTemporary ? <PinPill /> : null}
                </View>
              </View>
              <ChevronRight size={22} color={colors.muted} strokeWidth={2.2} />
            </Pressable>
          )}
          ListEmptyComponent={
            <Text tone="muted" className="pt-8 text-center text-lg">
              {t('staff.empty')}
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}
