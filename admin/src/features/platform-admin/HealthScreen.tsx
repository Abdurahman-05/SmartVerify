import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { NoConnection } from '@/components/ui/NoConnection';
import { SmallSpinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { getHealth, resolveError } from '@/lib/admin';
import { isNetworkError } from '@/lib/errors';

import { AdminShell } from './AdminShell';
import { causeText } from './causes';
import { ActionButton, Card, CardTitle, Chip, PageTitle, Tabs, fmtDateTime } from './ui';

const uptimeText = (seconds: number) => {
  const d = Math.floor(seconds / 86_400);
  const h = Math.floor((seconds % 86_400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
};

function Tile({
  title,
  value,
  detail,
  ok,
}: {
  title: string;
  value: string;
  detail: string;
  ok: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Card className="min-w-[240px] flex-1 gap-2">
      <View className="flex-row items-center justify-between gap-2">
        <Text font="bold" className="text-base">
          {title}
        </Text>
        <Chip
          label={ok ? t('platformAdmin.health.healthy') : t('platformAdmin.health.down')}
          tone={ok ? 'ok' : 'error'}
        />
      </View>
      <Text font="heading" className="text-[30px]">
        {value}
      </Text>
      <Text tone="muted" className="text-sm">
        {detail}
      </Text>
    </Card>
  );
}

/** Is everything working? App, database, server, the banks' receipt sites, Gemini, and errors. */
export default function HealthScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const queryClient = useQueryClient();
  const [errorsTab, setErrorsTab] = useState<'open' | 'resolved'>('open');
  const [recheck, setRecheck] = useState(false);
  const health = useQuery({
    queryKey: ['admin-health', recheck],
    queryFn: () => getHealth(recheck),
    refetchInterval: 60_000,
  });
  const resolve = useMutation({
    mutationFn: resolveError,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-health'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
  });

  if (health.isError && !health.data && isNetworkError(health.error)) {
    return (
      <AdminShell>
        <NoConnection onRetry={() => void health.refetch()} />
      </AdminShell>
    );
  }
  const h = health.data;
  if (!h) {
    return (
      <AdminShell>
        <View className="items-center py-10">
          <SmallSpinner />
        </View>
      </AdminShell>
    );
  }
  const openErrors = h.errors.filter((e) => !e.resolvedAt);
  const banksDown = h.banks.filter((b) => b.up === false);
  const allGood = h.database.ok && openErrors.length === 0 && banksDown.length === 0;
  const shown = errorsTab === 'open' ? openErrors : h.errors.filter((e) => e.resolvedAt);

  return (
    <AdminShell>
      <PageTitle
        title={t('platformAdmin.health.title')}
        subtitle={t('platformAdmin.health.updated', {
          time: fmtDateTime(new Date(health.dataUpdatedAt).toISOString(), lang),
        })}
        right={
          <ActionButton
            label={t('platformAdmin.health.recheck')}
            icon={RefreshCw}
            disabled={health.isFetching}
            onPress={() => {
              setRecheck(true);
              void health.refetch();
            }}
          />
        }
      />

      <View className={`gap-1 rounded-2xl px-5 py-4 ${allGood ? 'bg-successBg' : 'bg-warnBg'}`}>
        <Text font="heading" className={`text-lg ${allGood ? 'text-successFg' : 'text-warnFg'}`}>
          {allGood ? t('platformAdmin.health.allGood') : t('platformAdmin.health.problem')}
        </Text>
        {banksDown.map((b) => (
          <Text key={b.code} className="text-[15px] text-warnFg">
            {t(`platformAdmin.banks.${b.code}`)}:{' '}
            {b.downSince
              ? t('platformAdmin.health.downSince', { time: fmtDateTime(b.downSince, lang) })
              : t('platformAdmin.banks.down')}
          </Text>
        ))}
      </View>

      <View className="flex-row flex-wrap gap-[18px]">
        <Tile
          title={t('platformAdmin.health.app')}
          value={h.app.p50 !== null ? `${h.app.p50} ms` : '–'}
          detail={
            h.app.p95 !== null
              ? t('platformAdmin.health.typical', { ms: h.app.p95 })
              : t('platformAdmin.health.noSamples')
          }
          ok
        />
        <Tile
          title={t('platformAdmin.health.database')}
          value={h.database.ms !== null ? `${h.database.ms} ms` : '–'}
          detail={
            h.database.ok
              ? t('platformAdmin.health.dbDetail', { size: h.database.sizeMb ?? '–' })
              : t('platformAdmin.health.down')
          }
          ok={h.database.ok}
        />
        <Tile
          title={t('platformAdmin.health.server')}
          value={uptimeText(h.server.uptimeSeconds)}
          detail={t('platformAdmin.health.serverDetail', {
            uptime: uptimeText(h.server.uptimeSeconds),
            memory: h.server.memoryPercent,
          })}
          ok
        />
      </View>

      <View className="flex-row flex-wrap gap-[18px]">
        <Card className="min-w-[320px] flex-1">
          <CardTitle
            title={t('platformAdmin.health.banks')}
            subtitle={t('platformAdmin.health.banksBody')}
          />
          {h.banks.length === 0 ? (
            <Text tone="muted" className="text-[15px]">
              {t('platformAdmin.banks.unknown')}
            </Text>
          ) : null}
          {h.banks.map((b) => (
            <View
              key={b.code}
              className="flex-row flex-wrap items-center gap-3 border-t-[1.5px] border-divider py-3"
            >
              <Text font="bold" className="min-w-[140px] flex-1 text-[15px]">
                {t(`platformAdmin.banks.${b.code}`)}
              </Text>
              <Text tone="muted" className="text-sm">
                {b.uptime !== null ? t('platformAdmin.health.uptime', { value: b.uptime }) : ''}
              </Text>
              <Chip
                label={
                  b.up === null
                    ? t('platformAdmin.banks.unknown')
                    : t(b.up ? 'platformAdmin.banks.up' : 'platformAdmin.banks.down')
                }
                tone={b.up === null ? 'neutral' : b.up ? 'ok' : 'error'}
              />
            </View>
          ))}
        </Card>
        <Card className="min-w-[320px] flex-1">
          <CardTitle
            title={t('platformAdmin.health.reading')}
            subtitle={t('platformAdmin.health.readingBody')}
          />
          {!h.reading.geminiConfigured ? (
            <Chip label={t('platformAdmin.health.geminiOff')} tone="warn" />
          ) : null}
          {(
            [
              ['geminiCalls', h.reading.geminiCalls],
              ['rateLimited', h.reading.rateLimited],
              ['fallback', h.reading.ocrFallback],
            ] as const
          ).map(([key, value]) => (
            <View
              key={key}
              className="flex-row justify-between border-t-[1.5px] border-divider py-3"
            >
              <Text tone="muted" className="text-[15px]">
                {t(`platformAdmin.health.${key}`)}
              </Text>
              <Text font="bold" className="text-[15px]">
                {value}
              </Text>
            </View>
          ))}
        </Card>
      </View>

      <Card>
        <CardTitle
          title={t('platformAdmin.health.errors')}
          subtitle={t('platformAdmin.health.errorsBody')}
        />
        <Tabs<'open' | 'resolved'>
          value={errorsTab}
          onChange={setErrorsTab}
          options={[
            { key: 'open', label: t('platformAdmin.health.openTab'), count: openErrors.length },
            {
              key: 'resolved',
              label: t('platformAdmin.health.resolvedTab'),
              count: h.errors.length - openErrors.length,
            },
          ]}
        />
        {shown.length === 0 ? (
          <Text tone="muted" className="text-[15px]">
            {t('platformAdmin.health.none')}
          </Text>
        ) : (
          shown.map((e) => (
            <View
              key={e.id}
              className="flex-row flex-wrap items-center gap-4 border-t-[1.5px] border-divider py-3"
            >
              <View className="min-w-[220px] flex-[2]">
                <Text font="bold" className="text-[15px]">
                  {causeText(t, e.cause)}
                </Text>
                {e.route ? (
                  <Text tone="muted" className="text-sm">
                    {e.route}
                  </Text>
                ) : null}
              </View>
              <Text className="w-[70px] text-[15px]">× {e.count}</Text>
              <Text tone="muted" className="w-[140px] text-sm">
                {fmtDateTime(e.lastSeen, lang)}
              </Text>
              {!e.resolvedAt ? (
                <ActionButton
                  label={t('platformAdmin.health.resolve')}
                  disabled={resolve.isPending}
                  onPress={() => resolve.mutate(e.id)}
                />
              ) : null}
            </View>
          ))
        )}
      </Card>
    </AdminShell>
  );
}
