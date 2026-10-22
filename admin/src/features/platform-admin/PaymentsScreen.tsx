import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { AlertTriangle, ExternalLink } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, View } from 'react-native';

import { MoneyText } from '@/components/ui/MoneyText';
import { NoConnection } from '@/components/ui/NoConnection';
import { SmallSpinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { decideReview, getReviews, type PaymentReviewItem } from '@/lib/admin';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { colors } from '@/theme/tokens';

import { AdminShell } from './AdminShell';
import {
  ActionButton,
  Card,
  Chip,
  ErrorNote,
  Field,
  PageTitle,
  Row,
  Tabs,
  fmtDateTime,
} from './ui';

type Tab = 'pending' | 'approved' | 'rejected';

/** The bank's own page for the receipt (CBE link as sent, telebirr by number). */
const receiptUrl = (r: PaymentReviewItem) =>
  r.bankCode === 'TEL'
    ? `https://transactioninfo.ethiotelecom.et/receipt/${encodeURIComponent(r.receiptKey)}`
    : r.receiptKey;

/** Plan-payment receipts the server could not decide alone: approve, ask for the rest, or reject. */
export default function PaymentsScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('pending');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const list = useQuery({ queryKey: ['admin-reviews', tab], queryFn: () => getReviews(tab) });
  const { refetch } = list;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );
  const items = list.data?.items ?? [];
  const selected = items.find((i) => i.id === selectedId) ?? items[0] ?? null;

  const decide = useMutation({
    mutationFn: (decision: 'approve' | 'reject' | 'ask_rest') =>
      decideReview(selected?.id ?? '', decision, note.trim() || undefined),
    onSuccess: () => {
      setNote('');
      setSelectedId(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
    },
  });

  const bankName = (code: string) => t(`platformAdmin.banks.${code}`, { defaultValue: code });

  return (
    <AdminShell>
      <PageTitle
        title={t('platformAdmin.payments.title')}
        subtitle={t('platformAdmin.payments.subtitle')}
      />
      <Tabs<Tab>
        value={tab}
        onChange={(v) => {
          setTab(v);
          setSelectedId(null);
          decide.reset();
        }}
        options={[
          {
            key: 'pending',
            label: t('platformAdmin.payments.tabs.pending'),
            count: list.data?.pending,
          },
          { key: 'approved', label: t('platformAdmin.payments.tabs.approved') },
          { key: 'rejected', label: t('platformAdmin.payments.tabs.rejected') },
        ]}
      />

      {list.isError && !list.data && isNetworkError(list.error) ? (
        <NoConnection onRetry={() => void refetch()} />
      ) : !list.data ? (
        <View className="items-center py-10">
          <SmallSpinner />
        </View>
      ) : items.length === 0 ? (
        <Card>
          <Text tone="muted" className="text-base">
            {t('platformAdmin.payments.empty')}
          </Text>
        </Card>
      ) : (
        <View className="flex-row flex-wrap items-start gap-5">
          <View className="min-w-[300px] max-w-[460px] flex-1 gap-3">
            {items.map((r) => {
              const on = r.id === selected?.id;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => {
                    setSelectedId(r.id);
                    setNote('');
                    decide.reset();
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  className={`gap-2 rounded-2xl border-2 p-4 ${
                    on ? 'border-primary bg-primarySoft' : 'border-border bg-surface'
                  }`}
                >
                  <View className="flex-row justify-between gap-2">
                    <Text font="bold" className="flex-1 text-[15px]" numberOfLines={1}>
                      {r.businessName}
                    </Text>
                    <Text tone="muted" className="text-sm">
                      {fmtDateTime(r.createdAt, lang)}
                    </Text>
                  </View>
                  <Text tone="muted" className="text-sm">
                    {t('platformAdmin.payments.expected', {
                      amount: r.expectedEtb.toLocaleString('en-US'),
                      bank: bankName(r.bankCode),
                    })}
                  </Text>
                  {r.reasons[0] ? (
                    <Chip
                      label={t(`platformAdmin.reasons.${r.reasons[0]}`, {
                        defaultValue: r.reasons[0],
                      })}
                      tone={
                        ['TIMEOUT', 'UNREACHABLE', 'UNPARSEABLE'].includes(r.reasons[0])
                          ? 'error'
                          : 'warn'
                      }
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          {selected ? (
            <Card className="min-w-[340px] flex-[2]">
              <View className="flex-row flex-wrap items-start justify-between gap-3">
                <View className="flex-1 gap-0.5">
                  <Text font="heading" className="text-[22px]">
                    {selected.businessName}
                  </Text>
                  <Text tone="muted" className="text-sm">
                    {t('platformAdmin.payments.sent', {
                      date: fmtDateTime(selected.createdAt, lang),
                    })}{' '}
                    · {t(`platformAdmin.plans.${selected.plan}`)} ·{' '}
                    {t(`platformAdmin.plans.${selected.period}`)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => router.push(`/customers/${selected.businessId}`)}
                  accessibilityRole="link"
                  className="min-h-11 justify-center"
                >
                  <Text font="bold" tone="link" className="text-[15px]">
                    {t('platformAdmin.payments.openCustomer')}
                  </Text>
                </Pressable>
              </View>

              <View className="flex-row gap-3 rounded-2xl bg-warnBg px-4 py-3.5">
                <AlertTriangle size={22} color={colors.warnFg} strokeWidth={2} />
                <View className="flex-1 gap-0.5">
                  <Text font="bold" className="text-[15px] text-warnFg">
                    {t('platformAdmin.payments.why')}
                  </Text>
                  {selected.reasons.map((reason) => (
                    <Text key={reason} className="text-[15px] text-warnFg">
                      {t(`platformAdmin.reasons.${reason}`, { defaultValue: reason })}
                    </Text>
                  ))}
                </View>
              </View>

              <View>
                <Row label={t('platformAdmin.payments.bank')}>
                  <Text font="bold" className="text-[15px]">
                    {bankName(selected.bankCode)}
                  </Text>
                </Row>
                <Row label={t('platformAdmin.payments.reference')}>
                  <Text font="bold" className="text-[15px]" selectable>
                    {selected.reference ?? selected.receiptKey.split('/').pop() ?? '–'}
                  </Text>
                </Row>
                <Row label={t('platformAdmin.payments.paid')}>
                  {selected.paidEtb !== null ? (
                    <View className="flex-row flex-wrap items-center gap-2">
                      <MoneyText value={selected.paidEtb} className="text-base" />
                      {selected.paidEtb < selected.expectedEtb ? (
                        <Chip
                          label={t('platformAdmin.payments.low', {
                            amount: (selected.expectedEtb - selected.paidEtb).toLocaleString(
                              'en-US'
                            ),
                          })}
                          tone="error"
                        />
                      ) : null}
                    </View>
                  ) : (
                    <Text className="text-[15px]">–</Text>
                  )}
                </Row>
                <Row label={t('platformAdmin.payments.usedBefore')}>
                  <Chip
                    label={
                      selected.usedBefore
                        ? t('platformAdmin.payments.usedYes')
                        : t('platformAdmin.payments.usedNo')
                    }
                    tone={selected.usedBefore ? 'error' : 'ok'}
                  />
                </Row>
                <Row label={t('platformAdmin.payments.receipt')}>
                  <ActionButton
                    label={t('platformAdmin.payments.openReceipt')}
                    icon={ExternalLink}
                    onPress={() => void Linking.openURL(receiptUrl(selected))}
                  />
                </Row>
              </View>

              {selected.status === 'pending' ? (
                <>
                  <Field
                    label={t('platformAdmin.common.note')}
                    value={note}
                    onChangeText={setNote}
                    placeholder={t('platformAdmin.payments.notePlaceholder')}
                    multiline
                  />
                  <ErrorNote message={decide.error ? t(errorMessageKey(decide.error)) : null} />
                  <View className="flex-row flex-wrap gap-2.5">
                    <ActionButton
                      label={t('platformAdmin.payments.approve')}
                      variant="primary"
                      disabled={decide.isPending || selected.usedBefore}
                      onPress={() => decide.mutate('approve')}
                    />
                    <ActionButton
                      label={t('platformAdmin.payments.askRest')}
                      disabled={decide.isPending}
                      onPress={() => decide.mutate('ask_rest')}
                    />
                    <ActionButton
                      label={t('platformAdmin.payments.reject')}
                      variant="danger"
                      disabled={decide.isPending}
                      onPress={() => decide.mutate('reject')}
                    />
                  </View>
                  <Text tone="muted" className="text-sm">
                    {t('platformAdmin.payments.approveNote')}
                  </Text>
                </>
              ) : (
                <View className="gap-1">
                  <Text font="bold" className="text-[15px]">
                    {t('platformAdmin.payments.decided', {
                      status: t(`platformAdmin.payments.statusNames.${selected.status}`),
                      name: selected.decidedBy ?? '',
                      date: fmtDateTime(selected.decidedAt, lang),
                    })}
                  </Text>
                  {selected.note ? (
                    <Text tone="muted" className="text-[15px]">
                      {selected.note}
                    </Text>
                  ) : null}
                </View>
              )}
            </Card>
          ) : null}
        </View>
      )}
    </AdminShell>
  );
}
