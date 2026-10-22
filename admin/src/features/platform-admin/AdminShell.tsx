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
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { adminSignOut, getAdminProfile, getDashboard, hasAdminToken } from '@/lib/admin';
import { ApiError } from '@/lib/api/client';
import { colors } from '@/theme/tokens';

interface NavItem {
  key: string;
  icon: LucideIcon;
  href: Href;
}

const NAV: NavItem[] = [
  { key: 'home', icon: Home, href: '/' },
  { key: 'customers', icon: Users, href: '/customers' },
  { key: 'payments', icon: CreditCard, href: '/payments' },
  { key: 'rules', icon: SlidersHorizontal, href: '/rules' },
  { key: 'plans', icon: Tag, href: '/plans' },
  { key: 'health', icon: Activity, href: '/health' },
  { key: 'messages', icon: MessageSquare, href: '/messages' },
  { key: 'activity', icon: Clock, href: '/activity' },
];

/** At this width and wider the menu is a side bar; narrower, a bar on top. */
const WIDE = 1024;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

function BrandMark({ compact }: { compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-3">
      <View
        className={`items-center justify-center rounded-xl bg-primary ${compact ? 'h-9 w-9' : 'h-[42px] w-[42px]'}`}
      >
        <Check size={compact ? 20 : 24} color={colors.amber} strokeWidth={3} />
      </View>
      <View>
        <Text font="heading" className={compact ? 'text-base' : 'text-lg'}>
          {t('platformAdmin.brand')}
        </Text>
        {!compact ? (
          <Text tone="muted" className="text-sm">
            {t('platformAdmin.admin')}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * The admin's frame. Wide screens: a fixed side menu at full height, the page scrolling beside
 * it (max 1280 wide, centred). Phones: a top bar and a menu that scrolls sideways.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { width, height } = useWindowDimensions();
  const wide = width >= WIDE;
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
    return <Redirect href="/sign-in" />;
  }

  const signOut = async () => {
    await adminSignOut().catch(() => undefined);
    // Nothing of the admin's stays in memory.
    queryClient.removeQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('admin') });
    router.replace('/sign-in');
  };

  const admin = profile.data;
  const badges: Record<string, number> = {
    payments: dashboard.data?.needs.reviews ?? 0,
    health: dashboard.data?.needs.errors ?? 0,
  };
  const isActive = (href: Href) =>
    pathname === href || (href !== '/' && pathname.startsWith(`${String(href)}/`));

  const signOutButton = (
    <Pressable
      onPress={() => void signOut()}
      accessibilityRole="button"
      accessibilityLabel={t('platformAdmin.nav.signOut')}
      className="h-11 w-11 items-center justify-center rounded-xl active:bg-background"
    >
      <LogOut size={20} color={colors.muted} strokeWidth={2} />
    </Pressable>
  );

  const page = (
    <ScrollView className="flex-1" contentContainerClassName="items-center">
      <View className={`w-full max-w-[1280px] gap-7 ${wide ? 'px-10 py-9' : 'px-4 py-5'}`}>
        {children}
      </View>
    </ScrollView>
  );

  if (!wide) {
    return (
      <View className="flex-1 bg-background" style={{ height }}>
        <View className="border-b-[1.5px] border-border bg-surface">
          <View className="flex-row items-center justify-between px-4 pt-3">
            <BrandMark compact />
            {signOutButton}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2 px-4 py-3"
          >
            {NAV.map(({ key, href }) => {
              const active = isActive(href);
              const badge = badges[key] ?? 0;
              return (
                <Pressable
                  key={key}
                  onPress={() => router.push(href)}
                  accessibilityRole="link"
                  accessibilityState={{ selected: active }}
                  className={`h-11 flex-row items-center gap-2 rounded-[22px] px-4 ${
                    active ? 'bg-primary' : 'bg-background'
                  }`}
                >
                  <Text
                    font={active ? 'bold' : 'medium'}
                    tone={active ? 'inverse' : 'default'}
                    className="text-[15px]"
                  >
                    {t(`platformAdmin.nav.${key}`)}
                  </Text>
                  {badge > 0 ? (
                    <View className="min-w-6 items-center rounded-[10px] bg-amber px-1.5">
                      <Text font="bold" className="text-sm">
                        {badge}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
        {page}
      </View>
    );
  }

  return (
    <View className="flex-row bg-background" style={{ height }}>
      <View className="w-[248px] gap-1 border-r-[1.5px] border-border bg-surface px-4 py-6">
        <View className="px-2 pb-6">
          <BrandMark />
        </View>
        {NAV.map(({ key, icon: Icon, href }) => {
          const active = isActive(href);
          const badge = badges[key] ?? 0;
          return (
            <Pressable
              key={key}
              onPress={() => router.push(href)}
              accessibilityRole="link"
              accessibilityState={{ selected: active }}
              className={`min-h-11 flex-row items-center gap-3 rounded-xl px-3.5 ${
                active ? 'bg-primary' : 'hover:bg-background active:bg-background'
              }`}
            >
              <Icon size={20} color={active ? colors.surface : colors.muted} strokeWidth={2} />
              <Text
                font={active ? 'bold' : 'medium'}
                tone={active ? 'inverse' : 'default'}
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
        <View className="mt-auto flex-row items-center gap-3 border-t-[1.5px] border-border px-2 pt-4">
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
          {signOutButton}
        </View>
      </View>
      {page}
    </View>
  );
}
