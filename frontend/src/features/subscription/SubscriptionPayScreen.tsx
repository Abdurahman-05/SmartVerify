import { useMutation, useQuery } from '@tanstack/react-query';
import { scanFromURLAsync } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Copy, Image as ImageIcon, Landmark } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View } from 'react-native';

import { BankBadge } from '@/components/ui/BankBadge';
import { Button } from '@/components/ui/Button';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { FormScreen } from '@/components/ui/FormScreen';
import { LoadingView } from '@/components/ui/LoadingView';
import { MoneyText } from '@/components/ui/MoneyText';
import { NoConnection } from '@/components/ui/NoConnection';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { newIdempotencyKey } from '@/lib/api/idempotency';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { getPaymentInfo, payForPlan } from '@/lib/subscription';
import { findPayerBank, linkValue, type ReceiptField } from '@/features/verify/payerBanks';
import {
  cbeReceiptLink,
  dashenReferenceFromQr,
  dashenReferenceOf,
  isCbeReceiptLink,
  readReference,
  telebirrNumberFromQr,
  telebirrNumberOf,
} from '@/lib/verification';
import { useSession, type BillingPeriod, type Plan } from '@/store/session';
import { useBrandColors } from '@/store/theme';
import { colors } from '@/theme/tokens';

import { hasQuarterly, normalMultiMonthlyEtb, normalPricing } from './plans';

/** Banks a plan can be paid from; each is checked with its own bank's receipt. */
const SENDER_BANKS = ['CBE', 'TEL', 'DAS', 'BOA', 'MPE', 'EBR'] as const;
type Method = (typeof SENDER_BANKS)[number];
type Values = Partial<Record<ReceiptField['key'] | 'qr', string>>;

/** What the server needs for each bank (same references as Verify). */
function receiptFor(method: Method, v: Values) {
  switch (method) {
    case 'CBE':
      return { url: cbeReceiptLink(v.reference ?? '', v.senderAccount ?? '') };
    case 'TEL':
      return { telebirrNumber: v.transactionNumber ?? '' };
    case 'BOA':
      return { bank: 'BOA' as const, reference: `${v.reference ?? ''}${v.senderLast5 ?? ''}` };
    case 'MPE':
      return { bank: 'MPE' as const, reference: v.transactionNumber ?? '' };
    case 'EBR':
      return { bank: 'EBR' as const, reference: v.receiptLink ?? '' };
    case 'DAS':
      return { bank: 'DAS' as const, reference: v.reference ?? '' };
  }
}

/**
 * Pay for a plan by CBE transfer to Smart Verify, then upload the receipt: the server checks it
 * with CBE and starts the plan at once.
 */
export default function SubscriptionPayScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const brand = useBrandColors();
  const params = useLocalSearchParams<{ plan?: Plan; period?: BillingPeriod }>();
  const setSubscription = useSession((s) => s.setSubscription);
  const isOwner = useSession((s) => s.user?.role === 'owner');
  const [copied, setCopied] = useState(false);
  const [reading, setReading] = useState(false);
  const [values, setValues] = useState<Values>({});
  const [error, setError] = useState<string | null>(null);
  const [payKey] = useState(newIdempotencyKey);
  const [method, setMethod] = useState<Method>('CBE');
  // After an upload without a usable QR: the boxes for what the picture did not give.
  const [ask, setAsk] = useState<ReceiptField['key'][]>([]);

  const plan: Plan =
    params.plan === 'restaurant' ||
    params.plan === 'normal_multi' ||
    params.plan === 'restaurant_normal'
      ? params.plan
      : 'normal';
  const period: BillingPeriod =
    hasQuarterly(plan) && params.period === 'quarterly' ? 'quarterly' : 'monthly';

  const info = useQuery({ queryKey: ['subscription-payment-info'], queryFn: getPaymentInfo });

  const pay = useMutation({
    mutationFn: (receipt: ReturnType<typeof receiptFor>) =>
      payForPlan(plan, period, receipt, payKey),
    onSuccess: (result) => {
      const { check, subscription } = result;
      if (subscription) {
        setSubscription(subscription);
        router.replace('/subscription-started');
        return;
      }
      if ('review' in result && result.review === 'pending') {
        setError(t('subscriptionPay.inReview'));
        return;
      }
      setError(
        check.status === 'not_matching'
          ? check.reasons.map((r) => t(`verifyBank.check.reasons.${r}`)).join(' ')
          : check.status === 'unable_to_verify'
            ? t(`verifyBank.check.unableReasons.${check.reason}`)
            : t('common.somethingWrong')
      );
    },
    onError: (e) => setError(t(errorMessageKey(e))),
  });

  if (!isOwner) return <Redirect href="/subscription" />;
  if (info.isPending) return <LoadingView screenTitle={t('subscriptionPay.title')} />;
  if (info.isError && !info.data && isNetworkError(info.error)) {
    return <NoConnection onRetry={() => void info.refetch()} />;
  }
  if (reading) return <LoadingView title={t('verifyBank.read.reading')} />;
  if (pay.isPending) {
    return (
      <LoadingView
        title={t('verifyRestaurant.checking')}
        subtitle={t('subscriptionPay.checking')}
      />
    );
  }

  const payTo = info.data;
  const price = payTo
    ? plan === 'restaurant'
      ? payTo.prices.restaurant.monthly
      : plan === 'normal_multi'
        ? (payTo.prices.normal_multi?.monthly ?? normalMultiMonthlyEtb)
        : plan === 'restaurant_normal'
          ? (payTo.prices.restaurant_normal?.[period] ?? normalPricing[period].priceEtb)
          : payTo.prices.normal[period]
    : 0;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/subscription'));

  const copy = () => {
    if (!payTo) return;
    const number = method === 'TEL' ? (payTo.telebirr?.number ?? '') : payTo.accountNumber;
    void Clipboard.setStringAsync(number).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const fieldsOf = (m: Method) => findPayerBank(m)?.fields ?? [];
  const send = (m: Method, v: Values) =>
    pay.mutate(
      receiptFor(
        m,
        Object.fromEntries(fieldsOf(m).map((f) => [f.key, linkValue(f, v[f.key] ?? '')]))
      )
    );

  /** What a receipt QR gives for this bank, or null when it is not one of its receipts. */
  const fromQr = (data: string): Values | null => {
    if (method === 'CBE') return isCbeReceiptLink(data) ? { qr: data.trim() } : null;
    if (method === 'TEL') {
      const number = telebirrNumberFromQr(data) ?? telebirrNumberOf(data);
      return number ? { transactionNumber: number } : null;
    }
    if (method === 'DAS') {
      const reference = dashenReferenceFromQr(data) ?? dashenReferenceOf(data);
      return reference ? { reference } : null;
    }
    return null;
  };

  /**
   * The receipt screenshot. 1) A receipt QR in it: pay at once. 2) No QR: the server reads the
   * number (Gemini); then only what is still missing is asked (e.g. the sender's full account
   * number, of which the link takes the last 8 for CBE or 5 for BOA).
   */
  const upload = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.8,
    });
    const asset = picked.canceled ? undefined : picked.assets[0];
    if (!asset) return;
    setReading(true);
    try {
      const codes = await scanFromURLAsync(asset.uri, ['qr']).catch(() => []);
      const qr = codes.map((c) => fromQr(c.data)).find((v): v is Values => v !== null);
      if (qr) {
        setReading(false);
        if ('qr' in qr && qr.qr) pay.mutate({ url: qr.qr });
        else send(method, qr);
        return;
      }
      let found: Values = {};
      if (asset.base64) {
        const { reference } = await readReference(asset.base64, method);
        if (reference) {
          // BOA's SMS link gives the FT reference and the sender's last 5 together.
          const boa = method === 'BOA' ? /^(FT[A-Z0-9]{10})(\d{5})$/.exec(reference) : null;
          found =
            method === 'TEL' || method === 'MPE'
              ? { transactionNumber: reference }
              : method === 'EBR'
                ? { receiptLink: reference }
                : boa
                  ? { reference: boa[1], senderLast5: boa[2] }
                  : { reference };
        }
      }
      const missing = fieldsOf(method)
        .filter((f) => !f.valid(found[f.key] ?? ''))
        .map((f) => f.key);
      setReading(false);
      if (missing.length === 0) {
        send(method, found);
        return;
      }
      setValues(found);
      setAsk(missing);
    } catch (e) {
      setReading(false);
      setError(t(errorMessageKey(e)));
    }
  };

  const senderBank = findPayerBank(method);
  const fields = senderBank?.fields ?? [];
  const ready = fields.length > 0 && fields.every((f) => f.valid(values[f.key] ?? ''));
  // Telebirr pays our telebirr number; every other bank pays our CBE account.
  const toTelebirr = method === 'TEL';
  const banks = SENDER_BANKS.filter((b) => b !== 'TEL' || payTo?.telebirr);

  return (
    <FormScreen>
      <ScreenHeader
        title={t('subscriptionPay.title')}
        subtitle={t(`plans.${plan}`)}
        onBack={goBack}
      />

      {!payTo ? (
        <Text font="semibold" className="px-6 pt-10 text-center text-lg">
          {t(errorMessageKey(info.error))}
        </Text>
      ) : (
        <View className="gap-4 px-4 pt-2">
          <View className="items-center gap-1 rounded-[20px] bg-primary px-[18px] py-4">
            <Text font="semibold" tone="inverse" className="text-[15px]">
              {t('subscriptionPay.amount')}
            </Text>
            <MoneyText value={price} tone="inverse" className="text-4xl" />
          </View>

          <View className="gap-2">
            <Text font="bold" className="text-[17px]">
              {t('subscriptionPay.chooseBank')}
            </Text>
            <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
              {banks.map((code) => {
                const selected = method === code;
                return (
                  <Pressable
                    key={code}
                    onPress={() => {
                      setMethod(code);
                      setValues({});
                      setAsk([]);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={findPayerBank(code)?.name}
                    className={`min-h-12 flex-row items-center gap-2 rounded-[24px] py-1 pl-1 pr-3.5 ${
                      selected ? 'bg-primary' : 'border-2 border-borderStrong bg-surface'
                    }`}
                  >
                    <BankBadge code={code} size={40} />
                    <Text font="bold" tone={selected ? 'inverse' : 'default'} className="text-base">
                      {findPayerBank(code)?.shortName}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="gap-1">
            <Text font="bold" className="text-[17px]">
              {t('subscriptionPay.step1')}
            </Text>
            <View className="flex-row items-center gap-3 rounded-[18px] border-[1.5px] border-border bg-surface p-3">
              <BankBadge code={toTelebirr ? 'TEL' : 'CBE'} size={44} />
              <View className="min-w-0 flex-1">
                <Text font="heading" className="text-xl" selectable>
                  {toTelebirr ? payTo.telebirr?.number : payTo.accountNumber}
                </Text>
                <Text tone="muted" className="text-sm" numberOfLines={1}>
                  {toTelebirr
                    ? `${payTo.telebirr?.name ?? ''} · ${t('subscriptionPay.telebirr')}`
                    : `${payTo.accountName} · ${t('subscriptionPay.bank')}`}
                </Text>
              </View>
              <Pressable
                onPress={copy}
                accessibilityRole="button"
                accessibilityLabel={t('subscriptionPay.copy')}
                className="h-11 flex-row items-center gap-1 rounded-[22px] border-2 border-borderStrong bg-surface px-3 active:bg-background"
              >
                {copied ? (
                  <Check size={18} color={colors.success} strokeWidth={2.6} />
                ) : (
                  <Copy size={18} color={brand.primary} strokeWidth={2.2} />
                )}
                <Text font="bold" tone="link" className="text-sm">
                  {t(copied ? 'subscriptionPay.copied' : 'subscriptionPay.copy')}
                </Text>
              </Pressable>
            </View>
          </View>

          <View className="gap-2">
            <Text font="bold" className="text-[17px]">
              {t('subscriptionPay.step2')}
            </Text>
            <Button
              label={t('subscriptionPay.upload')}
              icon={ImageIcon}
              variant="outline"
              size="md"
              onPress={() => void upload()}
            />
            {ask.length > 0 ? (
              <Text font="semibold" className="text-[15px] text-warnFg">
                {t('subscriptionPay.needMore')}
              </Text>
            ) : null}
            {fields
              .filter((field) => ask.includes(field.key))
              .map((field) => (
                <TextInput
                  key={field.key}
                  value={values[field.key] ?? ''}
                  onChangeText={(v) =>
                    setValues((current) => ({ ...current, [field.key]: field.normalize(v) }))
                  }
                  placeholder={
                    field.last
                      ? t('verifyBank.found.fullAccount')
                      : field.typed
                        ? t(`verifyBank.short.${field.key}`)
                        : field.sample
                  }
                  placeholderTextColor={colors.placeholder}
                  keyboardType={field.input === 'digits' ? 'number-pad' : 'default'}
                  autoCapitalize={method === 'EBR' ? 'none' : 'characters'}
                  autoCorrect={false}
                  maxLength={field.length ?? 120}
                  accessibilityLabel={t(`verifyBank.short.${field.key}`)}
                  className="h-14 rounded-input border-[1.5px] border-borderStrong bg-surface px-4 font-heading text-xl text-text"
                />
              ))}
          </View>
        </View>
      )}

      <View className="min-h-6 flex-1" />
      {payTo && ask.length > 0 ? (
        <View className="px-4 pb-6 pt-2">
          <Button
            label={t('subscriptionPay.check')}
            icon={Landmark}
            disabled={!ready}
            onPress={() => send(method, values)}
          />
        </View>
      ) : null}

      <ErrorDialog
        visible={error !== null}
        title={t('subscriptionPay.notStarted')}
        message={error ?? ''}
        actionLabel={t('common.done')}
        onClose={() => setError(null)}
      />
    </FormScreen>
  );
}
