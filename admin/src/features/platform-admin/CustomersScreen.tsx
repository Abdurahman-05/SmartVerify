import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, Download, Search } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, useWindowDimensions, View } from 'react-native';

import { NoConnection } from '@/components/ui/NoConnection';
import { SmallSpinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { downloadCsv, getCustomers, type CustomerFilter, type PlanCode } from '@/lib/admin';
import { isNetworkError } from '@/lib/errors';
import { colors } from '@/theme/tokens';

import { AdminShell } from './AdminShell';
import { ActionButton, Card, PageTitle, StatusChip, Tabs } from './ui';

const PAGE = 25;

/** Every business: search, filter by plan/city/status, open one. */
export default function CustomersScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');
  const [plan, setPlan] = useState<PlanCode | undefined>();
  const [city, setCity] = useState<string | undefined>();
  const [filter, setFilter] = useState<CustomerFilter>('all');
  const [page, setPage] = useState(1);

  // Search after typing stops.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(typed.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [typed]);

  const narrow = useWindowDimensions().width < 760;
  const planName = (p: PlanCode | null) =>
    p ? t(`platformAdmin.plans.${p}`) : t('platformAdmin.plans.none');
  const q = { search, plan, city, filter, page };
  const list = useQuery({
    queryKey: ['admin-customers', q],
    queryFn: () => getCustomers(q),
    placeholderData: keepPreviousData,
  });
  const { refetch } = list;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );
  const data = list.data;

  const cycle = <T,>(values: (T | undefined)[], current: T | undefined) =>
    values[(values.indexOf(current) + 1) % values.length];

  return (
    <AdminShell>
      <PageTitle
        title={t('platformAdmin.customers.title')}
        subtitle={data ? t('platformAdmin.customers.count', { count: data.all }) : undefined}
        right={
          <ActionButton
            label={t('platformAdmin.common.export')}
            icon={Download}
            onPress={() => void downloadCsv('customers', q)}
          />
        }
      />

      <View className="flex-row flex-wrap items-center gap-3.5">
        <View className="h-12 min-w-[280px] max-w-[460px] flex-1 flex-row items-center gap-2.5 rounded-[14px] border-2 border-borderStrong bg-surface px-4">
          <Search size={20} color={colors.muted} strokeWidth={2} />
          <TextInput
            value={typed}
            onChangeText={setTyped}
            placeholder={t('platformAdmin.customers.search')}
            placeholderTextColor={colors.placeholder}
            accessibilityLabel={t('platformAdmin.customers.search')}
            className="flex-1 font-body text-base text-text"
          />
        </View>
        <ActionButton
          label={plan ? t(`platformAdmin.plans.${plan}`) : t('platformAdmin.customers.allPlans')}
          onPress={() => {
            setPlan(cycle<PlanCode>([undefined, 'normal', 'normal_multi', 'restaurant'], plan));
            setPage(1);
          }}
        />
        <ActionButton
          label={city ?? t('platformAdmin.customers.allCities')}
          onPress={() => {
            setCity(cycle<string>([undefined, ...(data?.cities ?? [])], city));
            setPage(1);
          }}
        />
      </View>

      <Tabs<CustomerFilter>
        value={filter}
        onChange={(f) => {
          setFilter(f);
          setPage(1);
        }}
        options={[
          { key: 'all', label: t('platformAdmin.customers.tabs.all'), count: data?.all },
          {
            key: 'overdue',
            label: t('platformAdmin.customers.tabs.overdue'),
            count: data?.tabs.overdue,
          },
          { key: 'trial', label: t('platformAdmin.customers.tabs.trial'), count: data?.tabs.trial },
          {
            key: 'restricted',
            label: t('platformAdmin.customers.tabs.restricted'),
            count: data?.tabs.restricted,
          },
          { key: 'new', label: t('platformAdmin.customers.tabs.new'), count: data?.tabs.new },
        ]}
      />

      {list.isError && !data && isNetworkError(list.error) ? (
        <NoConnection onRetry={() => void refetch()} />
      ) : (
        <Card className="gap-0 px-5 py-3">
          {narrow ? null : (
            <View className="flex-row gap-4 pb-2">
              {(['business', 'city', 'plan', 'statusCol'] as const).map((h) => (
                <Text
                  key={h}
                  font="bold"
                  tone="muted"
                  className={`text-sm uppercase ${h === 'business' ? 'flex-[2.2]' : h === 'statusCol' ? 'flex-[1.4]' : 'flex-1'}`}
                >
                  {t(`platformAdmin.customers.${h}`)}
                </Text>
              ))}
              <View className="w-6" />
            </View>
          )}
          {!data ? (
            <View className="items-center py-8">
              <SmallSpinner />
            </View>
          ) : data.items.length === 0 ? (
            <Text tone="muted" className="border-t-[1.5px] border-divider py-6 text-base">
              {t('platformAdmin.customers.empty')}
            </Text>
          ) : (
            data.items.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => router.push(`/customers/${c.id}`)}
                accessibilityRole="link"
                accessibilityLabel={c.name}
                className="min-h-16 flex-row items-center gap-4 rounded-xl border-t-[1.5px] border-divider py-3 active:bg-background"
              >
                <View className="flex-[2.2] flex-row items-center gap-3">
                  <View className="h-[42px] w-[42px] items-center justify-center rounded-full bg-primarySoft">
                    <Text font="bold" className="text-sm text-primary">
                      {c.name
                        .split(/\s+/)
                        .map((w) => w[0] ?? '')
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </Text>
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text font="bold" className="text-[15px]" numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text tone="muted" className="text-sm" numberOfLines={1}>
                      {narrow
                        ? [c.ownerPhone, c.city, planName(c.plan)].filter(Boolean).join(' · ')
                        : c.ownerPhone}
                    </Text>
                    {narrow ? (
                      <View className="pt-1.5">
                        <StatusChip status={c.status} daysLeft={c.daysLeft} exempt={c.exempt} />
                      </View>
                    ) : null}
                  </View>
                </View>
                {narrow ? null : (
                  <>
                    <Text className="flex-1 text-[15px]" numberOfLines={1}>
                      {c.city ?? '–'}
                    </Text>
                    <Text className="flex-1 text-[15px]" numberOfLines={1}>
                      {planName(c.plan)}
                    </Text>
                    <View className="flex-[1.4]">
                      <StatusChip status={c.status} daysLeft={c.daysLeft} exempt={c.exempt} />
                    </View>
                  </>
                )}
                <ChevronRight size={20} color={colors.muted} strokeWidth={2} />
              </Pressable>
            ))
          )}
        </Card>
      )}

      {data && data.total > 0 ? (
        <View className="flex-row flex-wrap items-center justify-between gap-3">
          <Text tone="muted" className="text-sm">
            {t('platformAdmin.customers.showing', {
              from: (page - 1) * PAGE + 1,
              to: Math.min(page * PAGE, data.total),
              total: data.total,
            })}
          </Text>
          <View className="flex-row gap-2">
            <ActionButton
              label={t('platformAdmin.customers.previous')}
              disabled={page === 1}
              onPress={() => setPage((p) => p - 1)}
            />
            <ActionButton
              label={t('platformAdmin.customers.next')}
              disabled={page * PAGE >= data.total}
              onPress={() => setPage((p) => p + 1)}
            />
          </View>
        </View>
      ) : null}
    </AdminShell>
  );
}
