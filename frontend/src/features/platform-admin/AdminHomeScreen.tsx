import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { getActivity, getAdminProfile } from '@/lib/admin';
import { colors } from '@/theme/tokens';

import { AdminShell } from './AdminShell';
import { ActivityRow } from './ActivityRow';

/** Admin home. Phase 1: your account and recent sign-ins; the business numbers come next. */
export default function AdminHomeScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const profile = useQuery({ queryKey: ['admin-profile'], queryFn: getAdminProfile });
  const recent = useQuery({
    queryKey: ['admin-activity', 'sign_in', 'home'],
    queryFn: () => getActivity({ category: 'sign_in' }),
  });
  const admin = profile.data;
  const today = new Date().toLocaleDateString(i18n.language === 'am' ? 'am-ET' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <AdminShell>
      <View className="gap-1">
        <Text tone="muted" className="text-[15px]">
          {today}
        </Text>
        <Text font="heading" className="text-[32px]" accessibilityRole="header">
          {t('platformAdmin.home.greeting', { name: admin?.name ?? '' })}
        </Text>
      </View>

      <View className="flex-row flex-wrap gap-[18px]">
        <View className="min-w-[280px] flex-1 gap-3 rounded-[20px] border-[1.5px] border-border bg-surface p-6">
          <Text font="heading" className="text-xl">
            {t('platformAdmin.home.account')}
          </Text>
          <View className="flex-row items-center gap-2">
            <ShieldCheck size={20} color={colors.success} strokeWidth={2.2} />
            <Text font="semibold" className="text-base">
              {t('platformAdmin.home.twoStepOn')}
            </Text>
          </View>
          {admin ? (
            <>
              <Text tone="muted" className="text-base">
                {t('platformAdmin.home.backupLeft', { count: admin.backupCodesLeft })}
              </Text>
              <Text tone="muted" className="text-base">
                {t('platformAdmin.home.signOutAfter', { count: admin.idleTimeoutMinutes })}
              </Text>
            </>
          ) : null}
        </View>
        <View className="min-w-[280px] flex-1 gap-2 rounded-[20px] border-[1.5px] border-amber bg-tipBg p-6">
          <Text font="heading" className="text-xl">
            {t('platformAdmin.home.nextTitle')}
          </Text>
          <Text className="text-base">{t('platformAdmin.home.nextBody')}</Text>
        </View>
      </View>

      <View className="gap-1 rounded-[20px] border-[1.5px] border-border bg-surface p-6">
        <View className="flex-row items-center justify-between">
          <Text font="heading" className="text-xl">
            {t('platformAdmin.home.recent')}
          </Text>
          <Pressable
            onPress={() => router.push('/console/activity')}
            accessibilityRole="link"
            className="min-h-11 justify-center"
          >
            <Text font="bold" tone="link" className="text-base">
              {t('platformAdmin.home.seeAll')}
            </Text>
          </Pressable>
        </View>
        {recent.data?.items.slice(0, 5).map((item) => (
          <ActivityRow key={item.id} item={item} />
        ))}
        {recent.data && recent.data.items.length === 0 ? (
          <Text tone="muted" className="py-4 text-base">
            {t('platformAdmin.activity.empty')}
          </Text>
        ) : null}
      </View>
    </AdminShell>
  );
}
