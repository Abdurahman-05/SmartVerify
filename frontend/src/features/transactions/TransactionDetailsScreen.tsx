import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Banknote, Check, ChevronLeft, Share2 } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BankBadge } from '@/components/ui/BankBadge';
import { GhostButton } from '@/components/ui/GhostButton';
import { IconTile } from '@/components/ui/IconTile';
import { LoadingView } from '@/components/ui/LoadingView';
import { formatMoney } from '@/components/ui/MoneyText';
import { NoConnection } from '@/components/ui/NoConnection';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StickyFooter } from '@/components/ui/StickyFooter';
import { Text } from '@/components/ui/Text';
import { TopBar } from '@/components/ui/TopBar';
import { bankAccountsKey, banks, getBankAccounts } from '@/lib/bankAccounts';
import { isNetworkError } from '@/lib/errors';
import { formatDay, formatTime } from '@/lib/format';
import { getPayment, paymentKey } from '@/lib/history';
import { colors } from '@/theme/tokens';
import { GlassCard, HeroCard, ScreenBg } from '@/ui/glass';

import { methodKey } from './methods';

function DetailRow({
  label,
  children,
  last,
}: {
  label: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <View
      accessible
      className={`min-h-[48px] flex-row items-center justify-between gap-3 py-3 ${last ? '' : 'border-b border-black/[0.07]'}`}
    >
      <Text tone="muted" className="text-[15px]">
        {label}
      </Text>
      {children}
    </View>
  );
}

const Value = ({ children, ok }: { children: ReactNode; ok?: boolean }) => (
  <Text
    font="bold"
    className="shrink text-right text-[15px]"
    style={ok ? { color: colors.successFg } : undefined}
    numberOfLines={1}
  >
    {children}
  </Text>
);

/** One paid bill: where the money went, the receipt, and who checked it. */
export default function TransactionDetailsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({ queryKey: paymentKey(id), queryFn: () => getPayment(id) });
  const accounts = useQuery({ queryKey: bankAccountsKey, queryFn: getBankAccounts });

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/transactions'));

  if (query.isPending)
    return <LoadingView screenTitle={t('history.detail.title')} onBack={goBack} />;
  if (query.isError && !query.data && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void query.refetch()} />;
  }
  const payment = query.data;
  if (!payment) {
    return (
      <ScreenBg>
        <SafeAreaView className="flex-1">
          <ScreenHeader title={t('history.detail.title')} onBack={goBack} />
          <Text tone="muted" className="px-6 pt-10 text-center text-lg">
            {t('history.detail.notFound')}
          </Text>
        </SafeAreaView>
      </ScreenBg>
    );
  }

  const date = `${formatDay(payment.createdAt)} · ${formatTime(payment.createdAt)}`;
  const bankCode = payment.bankCode ?? null;
  const bankFull = bankCode ? (banks.find((b) => b.code === bankCode)?.name ?? bankCode) : null;
  const account = (accounts.data ?? []).find((a) => a.id === payment.bankAccountId);
  const receivedIn = account
    ? [account.holderName, `${account.shortName} ••••${account.last4}`].filter(Boolean).join(' · ')
    : null;
  // Bank: the amount on the verified receipt; cash: the cash part of the sale.
  const received = bankCode ? (payment.receivedEtb ?? payment.bankEtb) : payment.cashEtb;
  const matches = received === payment.salesEtb;
  const extra = received - payment.salesEtb;
  const pill = bankCode
    ? matches
      ? t('history.detail.verifiedMatches')
      : extra > 0
        ? t('history.detail.verifiedExtra', { amount: formatMoney(extra) })
        : t('transactions.tag.verified')
    : t('history.detail.paidWith', { method: t(methodKey(payment.method)) });
  const checkedBy = `${payment.checkedBy ?? payment.recordedBy} · ${formatTime(payment.createdAt)}`;

  const share = () => {
    void Share.share({
      message: t('history.detail.shareText', {
        bill: payment.label,
        amount: formatMoney(payment.salesEtb),
        bank: bankFull ?? t(methodKey(payment.method)),
        reference: payment.reference ?? '',
        date,
      }),
    });
  };

  return (
    <ScreenBg>
      <SafeAreaView className="flex-1">
        <View className="px-4 pb-3 pt-2">
          <TopBar
            title={t('history.detail.title')}
            subtitle={payment.label}
            left={{ icon: ChevronLeft, onPress: goBack, label: t('common.back') }}
            right={{ icon: Share2, onPress: share, label: t('history.detail.share') }}
          />
        </View>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 112 }}
          showsVerticalScrollIndicator={false}
        >
          <HeroCard
            className="mx-4 items-center gap-2 px-4 py-6"
            accessible
            accessibilityLabel={`${bankFull ?? t(methodKey(payment.method))}, ${formatMoney(payment.salesEtb)}, ${pill}, ${date}`}
          >
            {bankCode ? (
              <View className="rounded-[16px] bg-white/20 p-1">
                <BankBadge code={bankCode} size={48} />
              </View>
            ) : (
              <IconTile icon={Banknote} size={56} radius={16} />
            )}
            <Text
              font="heading"
              tone="inverse"
              className="text-[44px] leading-[52px]"
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatMoney(payment.salesEtb, false)}{' '}
              <Text font="heading" tone="inverse" className="text-lg">
                {t('common.etb')}
              </Text>
            </Text>
            <View className="h-8 flex-row items-center gap-1.5 rounded-full bg-successBg px-3.5">
              <Check size={14} color={colors.successFg} strokeWidth={2.8} />
              <Text font="bold" className="text-sm" style={{ color: colors.successFg }}>
                {pill}
              </Text>
            </View>
          </HeroCard>

          <GlassCard className="mx-4 mt-3 px-4 py-1">
            {bankFull ? (
              <>
                <DetailRow
                  label={t('history.detail.bankName')}
                  last={!receivedIn && !payment.reference}
                >
                  <Value>{bankFull}</Value>
                </DetailRow>
                {receivedIn ? (
                  <DetailRow label={t('history.detail.receivedIn')} last={!payment.reference}>
                    <Value>{receivedIn}</Value>
                  </DetailRow>
                ) : null}
                {payment.reference ? (
                  <DetailRow label={t('history.detail.reference')} last>
                    <Value>{payment.reference}</Value>
                  </DetailRow>
                ) : null}
              </>
            ) : (
              <DetailRow label={t('history.detail.paidIn')} last>
                <Value>{t(methodKey(payment.method))}</Value>
              </DetailRow>
            )}
          </GlassCard>

          <GlassCard className="mx-4 mt-3 px-4 py-1">
            <DetailRow label={t('history.detail.expected')}>
              <Value>{formatMoney(payment.salesEtb)}</Value>
            </DetailRow>
            <DetailRow label={t('history.detail.received')}>
              <Value ok>{formatMoney(received)}</Value>
            </DetailRow>
            <DetailRow label={t('history.detail.bill')}>
              <Value>{payment.label}</Value>
            </DetailRow>
            <DetailRow label={t('history.detail.checkedBy')} last>
              <Value>{checkedBy}</Value>
            </DetailRow>
          </GlassCard>
        </ScrollView>

        <StickyFooter>
          <GhostButton label={t('history.detail.share')} icon={Share2} onPress={share} />
        </StickyFooter>
      </SafeAreaView>
    </ScreenBg>
  );
}
