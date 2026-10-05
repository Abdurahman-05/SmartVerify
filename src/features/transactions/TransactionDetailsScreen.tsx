import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Clock, Copy, Share2, X, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BankBadge } from '@/components/ui/BankBadge';
import { Button } from '@/components/ui/Button';
import { LoadingView } from '@/components/ui/LoadingView';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StatusPill } from '@/components/ui/StatusPill';
import { Text } from '@/components/ui/Text';
import { accountFor, getTransaction, type TransactionStatus } from '@/lib/api/transactions';
import { formatAmount, formatDay, formatTime } from '@/lib/format';
import { colors } from '@/theme/tokens';

const hero: Record<TransactionStatus, { bg: string; icon: LucideIcon }> = {
  verified: { bg: colors.primary, icon: Check },
  pending: { bg: colors.warnFg, icon: Clock },
  mismatch: { bg: colors.alert, icon: X },
  duplicate: { bg: colors.muted, icon: Copy },
};

function DetailRow({ label, children, last }: { label: string; children: ReactNode; last?: boolean }) {
  return (
    <View
      accessible
      className={`flex-row items-center justify-between gap-3 py-[13px] ${last ? '' : 'border-b-[1.5px] border-divider'}`}
    >
      <Text tone="muted" className="text-[15px]">
        {label}
      </Text>
      {children}
    </View>
  );
}

function Value({ children }: { children: string }) {
  return (
    <Text font="bold" className="flex-1 text-right text-base">
      {children}
    </Text>
  );
}

export default function TransactionDetailsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: tx, isPending } = useQuery({
    queryKey: ['transaction', id],
    queryFn: () => getTransaction(id),
  });

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/transactions'));

  if (isPending) return <LoadingView />;

  if (!tx) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ScreenHeader title={t('transaction.title')} onBack={goBack} />
        <Text tone="muted" className="px-6 pt-10 text-center text-lg">
          {t('transaction.notFound')}
        </Text>
      </SafeAreaView>
    );
  }

  const account = accountFor(tx);
  const { bg, icon: Icon } = hero[tx.status];
  const heading = t(`transaction.heading_${tx.status}`);
  const etb = (n: number) => `${formatAmount(n)} ${t('common.etb')}`;
  const date = `${formatDay(tx.createdAt)} · ${formatTime(tx.createdAt)}`;

  const share = () =>
    Share.share({
      message: t('transaction.shareMessage', {
        heading,
        amount: formatAmount(tx.receivedAmount),
        bank: account.bankName,
        reference: tx.reference,
        date,
      }),
    });

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader title={t('transaction.title')} onBack={goBack} />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View
          className="mx-4 mt-1 items-center gap-1 rounded-card px-5 py-[18px]"
          style={{ backgroundColor: bg }}
          accessible
          accessibilityLabel={`${heading}, ${etb(tx.receivedAmount)}, ${date}`}
        >
          <View className="h-[52px] w-[52px] items-center justify-center rounded-full bg-surface">
            <Icon size={28} color={bg} strokeWidth={3} />
          </View>
          <Text font="bold" tone="inverse" className="mt-1 text-base">
            {heading}
          </Text>
          <Text font="heading" tone="inverse" className="text-4xl" numberOfLines={1} adjustsFontSizeToFit>
            +{etb(tx.receivedAmount)}
          </Text>
          <Text font="semibold" tone="inverse" className="text-[15px]">
            {date}
          </Text>
        </View>

        <View className="mx-4 mt-3 rounded-card border-[1.5px] border-border bg-surface px-[18px] py-1">
          <View className="flex-row items-center gap-3 border-b-[1.5px] border-divider py-3">
            <BankBadge code={account.bankCode} />
            <View className="flex-1">
              <Text font="bold" className="text-[17px]">
                {account.bankName}
              </Text>
              <Text tone="muted" className="text-sm">
                {t('transaction.receivingAccount', { last4: account.last4 })}
              </Text>
            </View>
          </View>
          <DetailRow label={t('transaction.paidBy')}>
            <Value>{tx.payerName}</Value>
          </DetailRow>
          <DetailRow label={t('transaction.reference')}>
            <Value>{tx.reference}</Value>
          </DetailRow>
          <DetailRow label={t('transaction.expected')}>
            <Value>{etb(tx.expectedAmount)}</Value>
          </DetailRow>
          <DetailRow label={t('transaction.received')}>
            <Value>{etb(tx.receivedAmount)}</Value>
          </DetailRow>
          <DetailRow label={t('transaction.result')} last>
            <StatusPill
              status={tx.status}
              label={tx.status === 'verified' ? t('transaction.exactMatch') : undefined}
            />
          </DetailRow>
        </View>

        <View className="min-h-6 flex-1" />

        <View className="gap-2.5 px-4 pb-3">
          <Button label={t('transaction.share')} icon={Share2} variant="outline" size="md" onPress={share} />
          <Button label={t('transaction.back')} onPress={goBack} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
