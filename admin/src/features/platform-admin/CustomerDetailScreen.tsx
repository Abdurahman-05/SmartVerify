import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, MapPin, Phone } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Linking, Pressable, View } from 'react-native';

import { MoneyText } from '@/components/ui/MoneyText';
import { NoConnection } from '@/components/ui/NoConnection';
import { SmallSpinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import {
  addCustomerNote,
  changeCustomerPlan,
  exemptCustomer,
  extendCustomer,
  getCustomer,
  markCustomerPaid,
  suspendCustomer,
  type CustomerDetail,
  type PlanCode,
} from '@/lib/admin';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { colors } from '@/theme/tokens';

import { AdminShell } from './AdminShell';
import {
  ActionButton,
  Card,
  CardTitle,
  Chip,
  ErrorNote,
  Field,
  Row,
  StatusChip,
  Tabs,
  fmtDate,
} from './ui';

type Panel = 'extend' | 'paid' | 'suspend' | 'plan' | 'exempt' | null;

/** The OpenStreetMap tile (zoom 16) holding a point, and where in it the point falls. */
function osmTile(lat: number, lng: number) {
  const z = 16;
  const n = 2 ** z;
  const x = ((lng + 180) / 360) * n;
  const rad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  return {
    url: `https://tile.openstreetmap.org/${z}/${Math.floor(x)}/${Math.floor(y)}.png`,
    left: (x % 1) * 256,
    top: (y % 1) * 256,
  };
}

function Location({ c }: { c: CustomerDetail }) {
  const { t } = useTranslation();
  if (c.latitude === null || c.longitude === null) {
    return (
      <Text tone="muted" className="text-[15px]">
        {t('platformAdmin.customer.noLocation')}
      </Text>
    );
  }
  const tile = osmTile(c.latitude, c.longitude);
  return (
    <View className="gap-3">
      <View className="h-[256px] w-[256px] self-start overflow-hidden rounded-2xl bg-neutralBg">
        <Image
          source={{ uri: tile.url }}
          style={{ width: 256, height: 256 }}
          accessibilityLabel={t('platformAdmin.customer.location')}
        />
        <View className="absolute" style={{ left: tile.left - 14, top: tile.top - 28 }}>
          <MapPin size={28} color={colors.alert} fill={colors.alert} strokeWidth={1.5} />
        </View>
      </View>
      <Text tone="muted" className="text-sm">
        © OpenStreetMap contributors
      </Text>
      {c.address ? <Text className="text-[15px]">{c.address}</Text> : null}
      <Text tone="muted" className="text-sm">
        {c.latitude.toFixed(4)}° N, {c.longitude.toFixed(4)}° E
      </Text>
      <ActionButton
        label={t('platformAdmin.customer.openMaps')}
        icon={MapPin}
        onPress={() =>
          void Linking.openURL(`https://www.google.com/maps?q=${c.latitude},${c.longitude}`)
        }
      />
    </View>
  );
}

/** One customer: everything the team needs, and the actions (all saved in the activity log). */
export default function CustomerDetailScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const [panel, setPanel] = useState<Panel>(null);
  const [days, setDays] = useState('7');
  const [note, setNote] = useState('');
  const [plan, setPlan] = useState<PlanCode>('normal');
  const [period, setPeriod] = useState<'monthly' | 'quarterly'>('monthly');
  const [noteText, setNoteText] = useState('');

  const query = useQuery({ queryKey: ['admin-customer', id], queryFn: () => getCustomer(id) });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );
  const c = query.data;

  const action = useMutation({
    mutationFn: async (kind: Exclude<Panel, null> | 'note' | 'reactivate' | 'unexempt') => {
      const n = note.trim() || undefined;
      if (kind === 'extend') return extendCustomer(id, Number(days), n);
      if (kind === 'paid')
        return markCustomerPaid(id, plan, plan === 'restaurant' ? 'monthly' : period, n);
      if (kind === 'suspend') return suspendCustomer(id, true, n);
      if (kind === 'reactivate') return suspendCustomer(id, false);
      if (kind === 'plan') return changeCustomerPlan(id, plan);
      if (kind === 'exempt') return exemptCustomer(id, true, n);
      if (kind === 'unexempt') return exemptCustomer(id, false);
      return addCustomerNote(id, noteText.trim());
    },
    onSuccess: (_r, kind) => {
      setPanel(null);
      setNote('');
      if (kind === 'note') setNoteText('');
      void queryClient.invalidateQueries({ queryKey: ['admin-customer', id] });
      void queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
  });

  const open = (p: Exclude<Panel, null>) => {
    action.reset();
    setNote('');
    if (c?.plan) setPlan(c.plan);
    setPanel((cur) => (cur === p ? null : p));
  };

  if (query.isError && !c && isNetworkError(query.error)) {
    return (
      <AdminShell>
        <NoConnection onRetry={() => void refetch()} />
      </AdminShell>
    );
  }

  const stepIndex = c
    ? { trial: 0, active: 0, grace: 1, restricted: 2, suspended: 3 }[c.access.status]
    : 0;

  return (
    <AdminShell>
      <Pressable
        onPress={() => router.push('/customers')}
        accessibilityRole="link"
        className="min-h-11 flex-row items-center gap-1 self-start"
      >
        <ChevronLeft size={20} color={colors.primaryText} strokeWidth={2.2} />
        <Text font="bold" tone="link" className="text-[15px]">
          {t('platformAdmin.customer.back')}
        </Text>
      </Pressable>

      {!c ? (
        <View className="items-center py-10">
          <SmallSpinner />
        </View>
      ) : (
        <>
          <View className="flex-row flex-wrap items-start justify-between gap-4">
            <View className="min-w-[260px] flex-1 gap-2">
              <View className="flex-row flex-wrap items-center gap-3">
                <Text font="heading" className="text-[30px]" accessibilityRole="header">
                  {c.name}
                </Text>
                <StatusChip
                  status={c.access.status}
                  daysLeft={c.access.daysLeft}
                  exempt={c.exempt}
                />
              </View>
              <Text tone="muted" className="text-[15px]">
                {[
                  c.businessType,
                  c.city,
                  t('platformAdmin.customer.since', { date: fmtDate(c.createdAt, lang) }),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              {c.exempt ? (
                <Chip
                  label={t('platformAdmin.customer.exemptNote', { reason: c.exemptReason ?? '' })}
                  tone="ok"
                />
              ) : null}
              {c.access.suspendedByAdmin ? (
                <Chip label={t('platformAdmin.customer.suspendedNote')} tone="error" />
              ) : null}
            </View>
            <View className="min-w-0 max-w-full shrink flex-row flex-wrap gap-2">
              <ActionButton
                label={t('platformAdmin.customer.extend')}
                onPress={() => open('extend')}
              />
              <ActionButton
                label={t('platformAdmin.customer.markPaid')}
                variant="primary"
                onPress={() => open('paid')}
              />
              <ActionButton
                label={t('platformAdmin.customer.changePlan')}
                onPress={() => open('plan')}
              />
              {c.exempt ? (
                <ActionButton
                  label={t('platformAdmin.customer.removeExempt')}
                  onPress={() => action.mutate('unexempt')}
                />
              ) : (
                <ActionButton
                  label={t('platformAdmin.customer.exempt')}
                  onPress={() => open('exempt')}
                />
              )}
              {c.suspendedAt ? (
                <ActionButton
                  label={t('platformAdmin.customer.reactivate')}
                  onPress={() => action.mutate('reactivate')}
                />
              ) : (
                <ActionButton
                  label={t('platformAdmin.customer.suspend')}
                  variant="danger"
                  onPress={() => open('suspend')}
                />
              )}
            </View>
          </View>

          {panel ? (
            <Card className="border-primary">
              <CardTitle
                title={
                  panel === 'extend'
                    ? t('platformAdmin.customer.extendTitle')
                    : panel === 'paid'
                      ? t('platformAdmin.customer.markPaidTitle')
                      : panel === 'suspend'
                        ? t('platformAdmin.customer.suspendTitle')
                        : panel === 'plan'
                          ? t('platformAdmin.customer.changePlan')
                          : t('platformAdmin.customer.exempt')
                }
                subtitle={
                  panel === 'extend'
                    ? t('platformAdmin.customer.extendBody')
                    : panel === 'paid'
                      ? t('platformAdmin.customer.markPaidBody')
                      : panel === 'suspend'
                        ? t('platformAdmin.customer.suspendBody')
                        : undefined
                }
              />
              {panel === 'extend' ? (
                <Field
                  label={t('platformAdmin.common.days')}
                  value={days}
                  onChangeText={(v) => setDays(v.replace(/\D/g, '').slice(0, 3))}
                  keyboardType="number-pad"
                />
              ) : null}
              {panel === 'paid' || panel === 'plan' ? (
                <Tabs<PlanCode>
                  value={plan}
                  onChange={setPlan}
                  options={[
                    { key: 'normal', label: t('platformAdmin.plans.normal') },
                    { key: 'restaurant', label: t('platformAdmin.plans.restaurant') },
                  ]}
                />
              ) : null}
              {panel === 'paid' && plan === 'normal' ? (
                <Tabs<'monthly' | 'quarterly'>
                  value={period}
                  onChange={setPeriod}
                  options={[
                    { key: 'monthly', label: t('platformAdmin.plans.monthly') },
                    { key: 'quarterly', label: t('platformAdmin.plans.quarterly') },
                  ]}
                />
              ) : null}
              {panel === 'paid' ? (
                <MoneyText
                  value={
                    plan === 'restaurant'
                      ? c.prices.restaurantMonthly
                      : period === 'monthly'
                        ? c.prices.normalMonthly
                        : c.prices.normalQuarterly
                  }
                  className="text-2xl"
                />
              ) : null}
              {panel !== 'plan' ? (
                <Field
                  label={
                    panel === 'exempt'
                      ? t('platformAdmin.customer.exemptReason')
                      : t('platformAdmin.common.note')
                  }
                  value={note}
                  onChangeText={setNote}
                  placeholder={t('platformAdmin.common.notePlaceholder')}
                />
              ) : null}
              <ErrorNote message={action.error ? t(errorMessageKey(action.error)) : null} />
              <View className="flex-row flex-wrap gap-2">
                <ActionButton
                  label={t('platformAdmin.common.confirm')}
                  variant={panel === 'suspend' ? 'danger' : 'primary'}
                  disabled={action.isPending || (panel === 'extend' && !(Number(days) >= 1))}
                  onPress={() => action.mutate(panel)}
                />
                <ActionButton
                  label={t('platformAdmin.common.cancel')}
                  onPress={() => setPanel(null)}
                />
              </View>
            </Card>
          ) : null}

          {c.pendingReviews.length > 0 ? (
            <View className="flex-row flex-wrap items-center gap-3 rounded-2xl bg-warnBg px-5 py-4">
              <Text font="bold" className="flex-1 text-[15px] text-warnFg">
                {t('platformAdmin.customer.reviewWaiting')}
              </Text>
              <ActionButton
                label={t('platformAdmin.customer.reviewIt')}
                onPress={() => router.push('/payments')}
              />
            </View>
          ) : null}

          <View className="flex-row flex-wrap gap-[18px]">
            <View className="min-w-[340px] flex-[1.6] gap-[18px]">
              <Card>
                <CardTitle title={t('platformAdmin.customer.subscription')} />
                {c.current ? (
                  <View>
                    <Row label={t('platformAdmin.customers.plan')}>
                      <Text font="bold" className="text-[15px]">
                        {t(`platformAdmin.plans.${c.current.plan}`)} ·{' '}
                        {t(`platformAdmin.plans.${c.current.period}`)} ·{' '}
                        {t('platformAdmin.customer.price', {
                          price: c.current.priceEtb.toLocaleString('en-US'),
                        })}
                      </Text>
                    </Row>
                    <Row label={t('platformAdmin.customer.period')}>
                      <Text className="text-[15px]">
                        {fmtDate(c.current.startedAt, lang)} – {fmtDate(c.current.endsAt, lang)}
                      </Text>
                    </Row>
                  </View>
                ) : (
                  <Text tone="muted" className="text-[15px]">
                    {t('platformAdmin.customer.noPlan')}
                  </Text>
                )}
                <Text font="bold" className="text-[15px]">
                  {t('platformAdmin.customer.where')}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {(['active', 'grace', 'restricted', 'suspended'] as const).map((s, i) => {
                    const date =
                      i === 1
                        ? c.access.steps.endsAt
                        : i === 2
                          ? c.access.steps.graceEndsAt
                          : i === 3
                            ? c.access.steps.restrictedEndsAt
                            : null;
                    const here = i === stepIndex;
                    return (
                      <View
                        key={s}
                        className={`min-w-[120px] flex-1 gap-1 rounded-xl border-2 p-3 ${
                          here ? 'border-primary bg-primarySoft' : 'border-border bg-surface'
                        }`}
                      >
                        <Text font="bold" className="text-sm">
                          {t(`platformAdmin.customer.steps.${s}`)}
                        </Text>
                        <Text tone="muted" className="text-sm">
                          {here
                            ? t('platformAdmin.customer.now')
                            : date
                              ? fmtDate(date, lang)
                              : '–'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </Card>

              <Card>
                <CardTitle title={t('platformAdmin.customer.history')} />
                {c.payments.length === 0 ? (
                  <Text tone="muted" className="text-[15px]">
                    {t('platformAdmin.customer.historyNone')}
                  </Text>
                ) : (
                  c.payments.map((p) => (
                    <View
                      key={p.id}
                      className="flex-row flex-wrap items-center gap-3 border-t-[1.5px] border-divider py-3"
                    >
                      <Text tone="muted" className="w-[110px] text-[15px]">
                        {fmtDate(p.createdAt, lang)}
                      </Text>
                      <View className="min-w-[180px] flex-1">
                        <Text className="text-[15px]">
                          {t(`platformAdmin.customer.method.${p.paymentMethod ?? 'free'}`, {
                            defaultValue: p.paymentMethod ?? '–',
                          })}
                          {p.reference ? ` · ${p.reference}` : ''}
                        </Text>
                        {p.note ? (
                          <Text tone="muted" className="text-sm">
                            {p.note}
                          </Text>
                        ) : null}
                      </View>
                      <MoneyText value={p.priceEtb} className="text-base" />
                      {p.cancelled ? <Chip label={t('platformAdmin.customer.replaced')} /> : null}
                    </View>
                  ))
                )}
              </Card>

              <Card>
                <CardTitle title={t('platformAdmin.customer.notes')} />
                {c.notes.length === 0 ? (
                  <Text tone="muted" className="text-[15px]">
                    {t('platformAdmin.customer.notesNone')}
                  </Text>
                ) : (
                  c.notes.map((n) => (
                    <View key={n.id} className="gap-1 border-t-[1.5px] border-divider py-3">
                      <Text className="text-[15px]">{n.text}</Text>
                      <Text tone="muted" className="text-sm">
                        {n.adminName} · {fmtDate(n.createdAt, lang)}
                      </Text>
                    </View>
                  ))
                )}
                <Field
                  label={t('platformAdmin.customer.addNote')}
                  value={noteText}
                  onChangeText={setNoteText}
                  placeholder={t('platformAdmin.customer.notePlaceholder')}
                  multiline
                />
                <View className="self-start">
                  <ActionButton
                    label={t('platformAdmin.customer.addNote')}
                    disabled={!noteText.trim() || action.isPending}
                    onPress={() => action.mutate('note')}
                  />
                </View>
              </Card>
            </View>

            <View className="min-w-[300px] flex-1 gap-[18px]">
              <Card>
                <CardTitle title={t('platformAdmin.customer.people')} />
                {c.people.map((p) => (
                  <View
                    key={`${p.role}-${p.name}`}
                    className="flex-row flex-wrap items-center gap-3 border-t-[1.5px] border-divider py-3"
                  >
                    <View className="min-w-[150px] flex-1">
                      <Text font="bold" className="text-[15px]">
                        {p.name}
                      </Text>
                      <Text tone="muted" className="text-sm">
                        {t(`platformAdmin.customer.roles.${p.role}`)}
                        {p.phone ? ` · ${p.phone}` : ''}
                      </Text>
                      {p.lastSignInAt ? (
                        <Text tone="muted" className="text-sm">
                          {t('platformAdmin.customer.lastSignIn', {
                            date: fmtDate(p.lastSignInAt, lang),
                          })}
                        </Text>
                      ) : null}
                    </View>
                    {p.phone ? (
                      <ActionButton
                        label={t('platformAdmin.customer.call')}
                        icon={Phone}
                        onPress={() => void Linking.openURL(`tel:${p.phone?.replace(/\s/g, '')}`)}
                      />
                    ) : null}
                  </View>
                ))}
              </Card>

              <Card>
                <CardTitle title={t('platformAdmin.customer.location')} />
                <Location c={c} />
                <Text tone="muted" className="text-sm">
                  {t('platformAdmin.customer.privacy')}
                </Text>
              </Card>

              <Card>
                <CardTitle title={t('platformAdmin.customer.usage')} />
                <Row label={t('platformAdmin.customer.checks')}>
                  <Text font="bold" className="text-[15px]">
                    {c.usage.receiptChecks}
                  </Text>
                </Row>
                <Row label={t('platformAdmin.customer.verified')}>
                  <Text font="bold" className="text-[15px]">
                    {c.usage.verified}
                  </Text>
                </Row>
                <Row label={t('platformAdmin.customer.devices')}>
                  <Text font="bold" className="text-[15px]">
                    {c.usage.activeDevices}
                  </Text>
                </Row>
                <Row label={t('platformAdmin.customer.banks')}>
                  <Text className="text-[15px]">
                    {c.banks.length
                      ? c.banks
                          .map((b) => t(`platformAdmin.banks.${b}`, { defaultValue: b }))
                          .join(' · ')
                      : '–'}
                  </Text>
                </Row>
              </Card>
            </View>
          </View>
        </>
      )}
    </AdminShell>
  );
}
