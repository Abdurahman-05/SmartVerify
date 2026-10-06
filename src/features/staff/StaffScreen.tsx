import { useRouter } from 'expo-router';
import { Check, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { useSession } from '@/store/session';
import { colors } from '@/theme/tokens';

import { useStaff } from './store';
import type { Staff } from './types';

function RolePill({ role }: { role: Staff['role'] }) {
  const { t } = useTranslation();
  const isManager = role === 'manager';
  return (
    <View className={`rounded-[14px] py-[3px] pl-2 pr-2.5 ${isManager ? 'bg-text' : 'bg-successBg'}`}>
      <Text font="bold" className="text-sm" style={{ color: isManager ? colors.surface : colors.successFg }}>
        {t(`roles.${role}`)}
      </Text>
    </View>
  );
}

function ActivePill({ active }: { active: boolean }) {
  const { t } = useTranslation();
  return (
    <View
      className={`flex-row items-center gap-1 rounded-[14px] py-[3px] pl-2 pr-2.5 ${active ? 'bg-successBg' : 'bg-neutralBg'}`}
    >
      {active ? <Check size={14} color={colors.successFg} strokeWidth={2.6} /> : null}
      <Text font="bold" className="text-sm" style={{ color: active ? colors.successFg : colors.muted }}>
        {active ? t('staff.active') : t('staff.off')}
      </Text>
    </View>
  );
}

export default function StaffScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useSession((s) => s.user);
  const staff = useStaff((s) => s.staff);
  const setActive = useStaff((s) => s.setActive);

  const activeCount = staff.filter((m) => m.active).length;
  const isOwner = user?.role === 'owner';

  const canToggle = (member: Staff) => member.id !== user?.userId && (isOwner || member.role !== 'manager');

  const confirmToggle = (member: Staff) => {
    const turningOff = member.active;
    Alert.alert(
      t(turningOff ? 'staff.setOffTitle' : 'staff.setActiveTitle', { name: member.name }),
      t(turningOff ? 'staff.setOffBody' : 'staff.setActiveBody'),
      [
        { text: t('staff.cancel'), style: 'cancel' },
        {
          text: t(turningOff ? 'staff.confirmOff' : 'staff.confirmActive'),
          style: turningOff ? 'destructive' : 'default',
          onPress: () => setActive(member.id, !turningOff),
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader
        title={t('staff.title')}
        subtitle={t('staff.people', { count: staff.length, active: activeCount })}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
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

      <FlatList
        data={staff}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 16 }}
        renderItem={({ item }) => {
          const enabled = canToggle(item);
          return (
            <Pressable
              onPress={() => confirmToggle(item)}
              disabled={!enabled}
              accessibilityRole="button"
              accessibilityState={{ disabled: !enabled }}
              accessibilityLabel={t('staff.rowLabel', {
                name: item.name,
                role: t(`roles.${item.role}`),
                state: item.active ? t('staff.active') : t('staff.off'),
              })}
              className="flex-row items-center gap-3 rounded-[18px] border-[1.5px] border-border bg-surface px-3 py-2.5 active:bg-background"
            >
              <View className="h-12 w-12 items-center justify-center rounded-full bg-primary">
                <Text font="bold" tone="inverse" className="text-xl">
                  {item.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View className="flex-1">
                <Text font="bold" className="text-[17px]">
                  {item.name}
                </Text>
                <View className="mt-1 flex-row flex-wrap gap-1.5">
                  <RolePill role={item.role} />
                  <ActivePill active={item.active} />
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text tone="muted" className="pt-8 text-center text-lg">
            {t('staff.empty')}
          </Text>
        }
      />
    </SafeAreaView>
  );
}
