import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, usePathname, useRouter, type Href } from 'expo-router';
import {
  Activity,
  Check,
  Clock,
  CreditCard,
  Home,
  LogOut,
  MessageSquare,
  SlidersHorizontal,
  Tag,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { adminSignOut, getAdminProfile, getDashboard, hasAdminToken } from '@/lib/admin';
import { ApiError } from '@/lib/api/client';
import { colors } from '@/theme/tokens';

interface NavItem {
  key: string;
  icon: LucideIcon;
  /** No href yet: built in a later phase. */
  href?: Href;
}

const NAV: NavItem[] = [
  { key: 'home', icon: Home, href: '/console' },
  { key: 'customers', icon: Users, href: '/console/customers' },
  { key: 'payments', icon: CreditCard, href: '/console/payments' },
  { key: 'rules', icon: SlidersHorizontal, href: '/console/rules' },
  { key: 'plans', icon: Tag, href: '/console/plans' },
  { key: 'health', icon: Activity, href: '/console/health' },
  { key: 'messages', icon: MessageSquare, href: '/console/messages' },
  { key: 'activity', icon: Clock, href: '/console/activity' },
];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

/** The admin's frame: side menu (wraps above the page when narrow) and the page. */
export function AdminShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryKey: ['admin-profile'],
    queryFn: getAdminProfile,
    enabled: hasAdminToken(),
  });
  // Menu badges: payments waiting, new server problems (refreshed every minute).
  const dashboard = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: getDashboard,
    enabled: hasAdminToken(),
    refetchInterval: 60_000,
  });

  // Signed out, idle too long, or never signed in: back to sign-in.
  if (
    !hasAdminToken() ||
    (profile.error instanceof ApiError && profile.error.code === 'UNAUTHORIZED')
  ) {
    return <Redirect href="/console/sign-in" />;
  }

  const signOut = async () => {
    await adminSignOut().catch(() => undefined);
    // Nothing of the admin's stays in memory.
    queryClient.removeQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('admin') });
    router.replace('/console/sign-in');
  };

  const admin = profile.data;
  const badges: Record<string, number> = {
    payments: dashboard.data?.needs.reviews ?? 0,
    health: dashboard.data?.needs.errors ?? 0,
  };
  return (
    <View className="flex-1 flex-row flex-wrap bg-background">
      <View className="w-full gap-1 border-r-[1.5px] border-border bg-surface px-4 py-6 md:w-[244px]">
        <View className="flex-row items-center gap-3 px-2 pb-5">
          <View className="h-[42px] w-[42px] items-center justify-center rounded-xl bg-primary">
            <Check size={24} color={colors.amber} strokeWidth={3} />
          </View>
          <View>
            <Text font="heading" className="text-lg">
              {t('platformAdmin.brand')}
            </Text>
            <Text tone="muted" className="text-sm">
              {t('platformAdmin.admin')}
            </Text>
          </View>
        </View>
        {NAV.map(({ key, icon: Icon, href }) => {
          const active =
            href !== undefined &&
            (pathname === href || (href !== '/console' && pathname.startsWith(`${String(href)}/`)));
          const badge = badges[key] ?? 0;
          return (
            <Pressable
              key={key}
              disabled={!href}
              onPress={() => href && router.push(href)}
              accessibilityRole="link"
              accessibilityState={{ selected: active, disabled: !href }}
              className={`min-h-11 flex-row items-center gap-3 rounded-xl px-3.5 ${
                active ? 'bg-primary' : 'active:bg-background'
              }`}
            >
              <Icon size={20} color={active ? colors.surface : colors.muted} strokeWidth={2} />
              <Text
                font={active ? 'bold' : 'medium'}
                tone={active ? 'inverse' : href ? 'default' : 'muted'}
                className="flex-1 text-[15px]"
              >
                {t(`platformAdmin.nav.${key}`)}
              </Text>
              {badge > 0 ? (
                <View className="min-w-6 items-center rounded-[10px] bg-amber px-2 py-0.5">
                  <Text font="bold" className="text-sm">
                    {badge}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
        <View className="mt-4 flex-row items-center gap-3 border-t-[1.5px] border-border px-2 pt-4 md:mt-auto">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-amber">
            <Text font="bold" className="text-sm">
              {admin ? initials(admin.name) : ''}
            </Text>
          </View>
          <View className="min-w-0 flex-1">
            <Text font="bold" className="text-sm" numberOfLines={1}>
              {admin?.name ?? ''}
            </Text>
            <Text tone="muted" className="text-sm">
              {admin ? t(`platformAdmin.roles.${admin.role}`) : ''}
            </Text>
          </View>
          <Pressable
            onPress={() => void signOut()}
            accessibilityRole="button"
            accessibilityLabel={t('platformAdmin.nav.signOut')}
            className="h-11 w-11 items-center justify-center rounded-xl active:bg-background"
          >
            <LogOut size={20} color={colors.muted} strokeWidth={2} />
          </Pressable>
        </View>
      </View>
      <ScrollView className="min-w-0 flex-1" contentContainerClassName="gap-7 px-6 py-9 md:px-11">
        {children}
      </ScrollView>
    </View>
  );
}
