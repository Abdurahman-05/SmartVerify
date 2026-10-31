import { useMutation } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { CircleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatMoney } from '@/components/ui/MoneyText';
import { Button } from '@/components/ui/Button';
import { ResultBadge } from '@/components/ui/ResultBadge';
import { Text } from '@/components/ui/Text';
import { errorMessageKey } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { isNormalApp } from '@/lib/variant';
import { keepTip } from '@/lib/verification';
import { useSession } from '@/store/session';
import { colors } from '@/theme/tokens';

import { useReceiptFlow } from './receiptFlow';
import { useVerifyFlow, type VerificationResult } from './verifyFlow';

interface Row {
  label: string;
  value: string;
}

export function DetailsCard({ rows }: { rows: Row[] }) {
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

function useResultContent({ check, expectedAmountEtb, checkedAt }: VerificationResult) {
  const { t } = useTranslation();
  const etb = (n: number) => formatMoney(n);
  const expected = { label: t('verify.result.expected'), value: etb(expectedAmountEtb) };

  if (check.status === 'verified') {
    return {
      title: t('verify.result.verifiedTitle'),
      body: t('verify.result.verifiedBody'),
      note: t('verify.result.receiptSaved'),
      rows: [
        { label: t('verify.result.amount'), value: etb(check.amountEtb) },
        { label: t('verify.result.account'), value: check.receiverName },
        { label: t('verify.result.reference'), value: check.reference },
        { label: t('verify.result.verifiedAt'), value: formatDateTime(checkedAt) },
      ],
    };
  }

  const note = t('verify.result.noMoneyTaken');
  if (check.status === 'unable_to_verify') {
    return {
      title: t('verifyBank.check.unable'),
      body: t(`verifyBank.check.unableReasons.${check.reason}`),
      note,
      rows: [expected],
    };
  }

  const reference = { label: t('verify.result.reference'), value: check.reference };
  if (check.reasons.includes('DUPLICATE')) {
    return {
      title: t('verify.result.duplicateTitle'),
      body: t('verify.result.duplicateBody'),
      note,
      rows: [
        reference,
        ...(check.firstCheckedAt
          ? [
              {
                label: t('verify.result.firstVerified'),
                value: formatDateTime(check.firstCheckedAt),
              },
            ]
          : []),
      ],
    };
  }
  const [first] = check.reasons;
  return {
    title:
      first === 'AMOUNT_TOO_LOW' || !first
        ? t('verify.result.amountMismatchTitle')
        : t(`verifyBank.check.titles.${first}`),
    body: check.reasons.map((r) => t(`verifyBank.check.reasons.${r}`)).join(' '),
    note,
    rows: [expected, { label: t('verify.result.paid'), value: etb(check.amountEtb) }, reference],
  };
}

/**
 * Normal plan in the Restaurant app: the customer paid more. The waiter says whether they kept the
 * extra as their tip or gave it back (the server keeps the tip for the Tips page).
 */
function TipChoice({ reference, extraEtb }: { reference: string; extraEtb: number }) {
  const { t } = useTranslation();
  const [choice, setChoice] = useState<'tip' | 'back' | null>(null);
  const save = useMutation({
    mutationFn: (kept: boolean) => keepTip(reference, kept ? extraEtb : 0),
    onSuccess: (_, kept) => setChoice(kept ? 'tip' : 'back'),
  });
  const amount = formatMoney(extraEtb);
  return (
    <View className="mt-4 gap-2.5 rounded-[20px] border-2 border-amber bg-tipBg px-4 py-3.5">
      <Text font="heading" className="text-lg">
        {t('verify.result.tipTitle', { amount })}
      </Text>
      {choice ? (
        <Text font="semibold" className="text-base">
          {choice === 'tip'
            ? t('verify.result.tipSaved', { amount })
            : t('verify.result.gaveBackSaved')}
        </Text>
      ) : (
        <>
          <Text tone="muted" className="text-[15px]">
            {t('verify.result.tipBody')}
          </Text>
          <Button
            label={t('verify.result.keepTip')}
            variant="amber"
            size="md"
            disabled={save.isPending}
            onPress={() => save.mutate(true)}
          />
          <Button
            label={t('verify.result.gaveBack')}
            variant="secondary"
            size="md"
            disabled={save.isPending}
            onPress={() => save.mutate(false)}
          />
          {save.isError ? (
            <Text className="text-[15px] text-dangerFg">{t(errorMessageKey(save.error))}</Text>
          ) : null}
        </>
      )}
    </View>
  );
}

function ResultView({ result }: { result: VerificationResult }) {
  const { t } = useTranslation();
  const router = useRouter();
  const finish = useVerifyFlow((s) => s.finish);
  const success = result.check.status === 'verified';
  const content = useResultContent(result);
  // Tips from overpayments: only the Restaurant app's Normal plan (Restaurant Plus uses bills).
  const plan = useSession((s) => s.user?.plan);
  const askTip =
    !isNormalApp &&
    plan !== 'restaurant' &&
    result.check.status === 'verified' &&
    result.check.extraEtb > 0;

  const done = () => {
    finish();
    if (router.canGoBack()) router.back();
    else router.replace('/verify');
  };

  const shareReceipt = () => {
    const { check } = result;
    if (check.status !== 'verified') return;
    Share.share({
      message: t('verify.result.shareMessage', {
        amount: formatMoney(check.amountEtb, false),
        account: check.receiverName,
        reference: check.reference,
        date: formatDateTime(result.checkedAt),
      }),
    });
  };

  return (
    <SafeAreaView className={`flex-1 ${success ? 'bg-background' : 'bg-dangerSurface'}`}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingTop: 32,
          paddingBottom: 32,
        }}
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

        {askTip && result.check.status === 'verified' ? (
          <TipChoice reference={result.check.reference} extraEtb={result.check.extraEtb} />
        ) : null}

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
                onPress={() => {
                  // Again from the bank choice, like the first time.
                  useReceiptFlow.getState().setMode('normal');
                  router.replace('/verify-bank');
                }}
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
