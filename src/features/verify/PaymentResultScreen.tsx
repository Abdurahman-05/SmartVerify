import { Redirect, useRouter } from 'expo-router';
import { Check, CircleAlert, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import type { VerificationResult } from '@/lib/api/verify';
import { formatAmount, formatDateTime } from '@/lib/format';
import { colors } from '@/theme/tokens';

import { useVerifyFlow } from './verifyFlow';

interface Row {
  label: string;
  value: string;
}

function ResultBadge({ success }: { success: boolean }) {
  const tint = success ? colors.success : colors.alert;
  const Icon = success ? Check : X;
  return (
    <View className="h-[200px] w-[200px] items-center justify-center">
      <Svg width={200} height={200} viewBox="0 0 200 200" style={{ position: 'absolute' }}>
        <Circle cx={100} cy={100} r={98} fill="none" stroke={tint} strokeWidth={1.5} opacity={0.18} />
        <Circle cx={100} cy={100} r={76} fill="none" stroke={tint} strokeWidth={1.5} opacity={0.32} />
        <Circle cx={100} cy={100} r={56} fill={tint} opacity={0.14} />
      </Svg>
      <View
        className="h-[84px] w-[84px] items-center justify-center rounded-full"
        style={{ backgroundColor: tint }}
      >
        <Icon size={40} color={colors.surface} strokeWidth={2.6} />
      </View>
    </View>
  );
}

function DetailsCard({ rows }: { rows: Row[] }) {
  return (
    <View className="mt-8 rounded-[20px] border border-border bg-surface px-5 py-1">
      {rows.map((row, i) => (
        <View
          key={row.label}
          accessible
          className={`flex-row items-center justify-between gap-4 py-4 ${i < rows.length - 1 ? 'border-b border-divider' : ''}`}
        >
          <Text className="text-sm text-navInactive">{row.label}</Text>
          <Text font="semibold" className="flex-1 text-right text-[15px]">
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function useResultContent(result: VerificationResult) {
  const { t } = useTranslation();
  const etb = (n: number) => `${formatAmount(n)} ${t('common.etb')}`;
  const reference = { label: t('verify.result.reference'), value: result.reference };

  if (result.status === 'verified') {
    return {
      title: t('verify.result.verifiedTitle'),
      body: t('verify.result.verifiedBody'),
      note: t('verify.result.receiptSaved'),
      rows: [
        { label: t('verify.result.amount'), value: etb(result.amount) },
        { label: t('verify.result.account'), value: result.accountName },
        reference,
        { label: t('verify.result.verifiedAt'), value: formatDateTime(result.verifiedAt) },
      ],
    };
  }

  const note = t('verify.result.noMoneyTaken');
  switch (result.reason) {
    case 'nameMismatch':
      return {
        title: t('verify.result.nameMismatchTitle'),
        body: t('verify.result.nameMismatchBody'),
        note,
        rows: [
          { label: t('verify.result.registeredName'), value: result.registeredName },
          { label: t('verify.result.payerName'), value: result.payerName },
          reference,
        ],
      };
    case 'amountMismatch':
      return {
        title: t('verify.result.amountMismatchTitle'),
        body: t('verify.result.amountMismatchBody'),
        note,
        rows: [
          { label: t('verify.result.expected'), value: etb(result.expectedAmount) },
          { label: t('verify.result.paid'), value: etb(result.paidAmount) },
          reference,
        ],
      };
    case 'duplicate':
      return {
        title: t('verify.result.duplicateTitle'),
        body: t('verify.result.duplicateBody'),
        note,
        rows: [
          reference,
          { label: t('verify.result.firstVerified'), value: formatDateTime(result.firstVerifiedAt) },
        ],
      };
  }
}

function ResultView({ result }: { result: VerificationResult }) {
  const { t } = useTranslation();
  const router = useRouter();
  const finish = useVerifyFlow((s) => s.finish);
  const success = result.status === 'verified';
  const content = useResultContent(result);

  const done = () => {
    finish();
    if (router.canGoBack()) router.back();
    else router.replace('/verify');
  };

  const shareReceipt = () => {
    if (result.status !== 'verified') return;
    Share.share({
      message: t('verify.result.shareMessage', {
        amount: formatAmount(result.amount),
        account: result.accountName,
        reference: result.reference,
        date: formatDateTime(result.verifiedAt),
      }),
    });
  };

  return (
    <SafeAreaView className={`flex-1 ${success ? 'bg-background' : 'bg-dangerSurface'}`}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center" accessibilityLiveRegion="assertive">
          <ResultBadge success={success} />
          <Text font="heading" className="mt-5 text-center text-[26px]" accessibilityRole="header">
            {content.title}
          </Text>
          <Text className="mt-2.5 max-w-[300px] text-center text-base leading-6 text-navInactive">
            {content.body}
          </Text>
        </View>

        <DetailsCard rows={content.rows} />

        <View className="mt-4 flex-row items-start gap-2.5 px-1">
          <CircleAlert size={18} color={success ? colors.success : colors.alert} strokeWidth={2} />
          <Text className="flex-1 text-sm leading-5 text-navInactive">{content.note}</Text>
        </View>

        <View className="min-h-6 flex-1" />

        <View className="gap-3">
          {success ? (
            <>
              <Button label={t('verify.result.done')} variant="success" onPress={done} />
              <Button
                label={t('verify.result.share')}
                variant="secondary"
                size="md"
                onPress={shareReceipt}
              />
            </>
          ) : (
            <>
              <Button
                label={t('verify.result.tryAgain')}
                variant="danger"
                onPress={() => router.replace('/scan')}
              />
              <Button
                label={t('verify.result.contactSupport')}
                variant="secondary"
                size="md"
                disabled
                onPress={() => {}}
              />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function PaymentResultScreen() {
  // Snapshot so clearing the flow on "Done" doesn't blank the screen mid-transition.
  const [result] = useState(() => useVerifyFlow.getState().result);
  if (!result) return <Redirect href="/verify" />;
  return <ResultView result={result} />;
}
