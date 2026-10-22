import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { SmallSpinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { createAnnouncement, endAnnouncement, getAnnouncements, type PlanCode } from '@/lib/admin';
import { errorMessageKey } from '@/lib/errors';

import { AdminShell } from './AdminShell';
import {
  ActionButton,
  Card,
  CardTitle,
  Chip,
  ErrorNote,
  Field,
  PageTitle,
  Tabs,
  fmtDateTime,
} from './ui';

type Audience = 'all' | 'plan' | 'city';

/** "2026-10-24 08:00" in local time, for the date fields. */
const local = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const parseLocal = (text: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Banners for the customers' app: to everyone, one plan or one city, for a time window. */
export default function MessagesScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['admin-announcements'], queryFn: getAnnouncements });
  const [audience, setAudience] = useState<Audience>('all');
  const [plan, setPlan] = useState<PlanCode>('normal');
  const [city, setCity] = useState('');
  const [bodyEn, setBodyEn] = useState('');
  const [bodyAm, setBodyAm] = useState('');
  const [from, setFrom] = useState(() => local(new Date()));
  const [to, setTo] = useState(() => local(new Date(Date.now() + 24 * 3_600_000)));

  const showFrom = parseLocal(from);
  const hideOn = parseLocal(to);
  const valid =
    bodyEn.trim().length >= 3 &&
    bodyAm.trim().length >= 3 &&
    !!showFrom &&
    !!hideOn &&
    hideOn > showFrom &&
    (audience !== 'city' || city.trim().length >= 2);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
  const send = useMutation({
    mutationFn: () =>
      createAnnouncement({
        bodyEn: bodyEn.trim(),
        bodyAm: bodyAm.trim(),
        audience,
        plan: audience === 'plan' ? plan : undefined,
        city: audience === 'city' ? city.trim() : undefined,
        showFrom: (showFrom ?? new Date()).toISOString(),
        hideOn: (hideOn ?? new Date()).toISOString(),
      }),
    onSuccess: () => {
      setBodyEn('');
      setBodyAm('');
      refresh();
    },
  });
  const end = useMutation({ mutationFn: endAnnouncement, onSuccess: refresh });

  return (
    <AdminShell>
      <PageTitle
        title={t('platformAdmin.messages.title')}
        subtitle={t('platformAdmin.messages.subtitle')}
      />
      <View className="flex-row flex-wrap items-start gap-[18px]">
        <Card className="min-w-[340px] flex-[1.4]">
          <CardTitle title={t('platformAdmin.messages.new')} />
          <Text font="bold" className="text-[15px]">
            {t('platformAdmin.messages.who')}
          </Text>
          <Tabs<Audience>
            value={audience}
            onChange={setAudience}
            options={[
              { key: 'all', label: t('platformAdmin.messages.everyone') },
              { key: 'plan', label: t('platformAdmin.messages.onePlan') },
              { key: 'city', label: t('platformAdmin.messages.oneCity') },
            ]}
          />
          {audience === 'plan' ? (
            <Tabs<PlanCode>
              value={plan}
              onChange={setPlan}
              options={[
                { key: 'normal', label: t('platformAdmin.plans.normal') },
                { key: 'restaurant', label: t('platformAdmin.plans.restaurant') },
              ]}
            />
          ) : null}
          {audience === 'city' ? (
            <Field label={t('platformAdmin.messages.city')} value={city} onChangeText={setCity} />
          ) : null}
          <Field
            label={t('platformAdmin.messages.english')}
            value={bodyEn}
            onChangeText={setBodyEn}
            multiline
            maxLength={300}
          />
          <Field
            label={t('platformAdmin.messages.amharic')}
            value={bodyAm}
            onChangeText={setBodyAm}
            multiline
            maxLength={300}
          />
          <View className="flex-row flex-wrap gap-4">
            <View className="min-w-[200px] flex-1">
              <Field
                label={t('platformAdmin.messages.showFrom')}
                value={from}
                onChangeText={setFrom}
                hint={t('platformAdmin.messages.dateHint')}
              />
            </View>
            <View className="min-w-[200px] flex-1">
              <Field label={t('platformAdmin.messages.hideOn')} value={to} onChangeText={setTo} />
            </View>
          </View>
          <ErrorNote message={send.error ? t(errorMessageKey(send.error)) : null} />
          {send.isSuccess ? <Chip label={t('platformAdmin.messages.sentOk')} tone="ok" /> : null}
          <View className="self-start">
            <ActionButton
              label={t('platformAdmin.messages.send')}
              variant="primary"
              disabled={!valid || send.isPending}
              onPress={() => send.mutate()}
            />
          </View>
        </Card>

        <View className="min-w-[300px] flex-1 gap-[18px]">
          <Card>
            <CardTitle title={t('platformAdmin.messages.before')} />
            {!list.data ? (
              <SmallSpinner />
            ) : list.data.length === 0 ? (
              <Text tone="muted" className="text-[15px]">
                {t('platformAdmin.messages.none')}
              </Text>
            ) : (
              list.data.map((a) => (
                <View key={a.id} className="gap-1.5 border-t-[1.5px] border-divider py-3">
                  <Text className="text-[15px]">{lang === 'am' ? a.bodyAm : a.bodyEn}</Text>
                  <Text tone="muted" className="text-sm">
                    {a.audience === 'all'
                      ? t('platformAdmin.messages.everyone')
                      : a.audience === 'plan'
                        ? t(`platformAdmin.plans.${a.plan ?? 'normal'}`)
                        : a.city}{' '}
                    · {fmtDateTime(a.showFrom, lang)} – {fmtDateTime(a.hideOn, lang)}
                  </Text>
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Chip
                      label={t(`platformAdmin.messages.state.${a.state}`)}
                      tone={a.state === 'showing' ? 'ok' : 'neutral'}
                    />
                    {a.state !== 'ended' ? (
                      <ActionButton
                        label={t('platformAdmin.messages.end')}
                        variant="danger"
                        disabled={end.isPending}
                        onPress={() => end.mutate(a.id)}
                      />
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </Card>
          <Card>
            <CardTitle
              title={t('platformAdmin.messages.sms')}
              subtitle={t('platformAdmin.messages.smsBody')}
            />
            <Chip label={t('platformAdmin.messages.later')} />
          </Card>
        </View>
      </View>
    </AdminShell>
  );
}
