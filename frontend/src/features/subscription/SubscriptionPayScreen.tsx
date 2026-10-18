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
import { cbeReceiptLink, isCbeReceiptLink, readReference } from '@/lib/verification';
import { useSession, type BillingPeriod, type Plan } from '@/store/session';
import { useBrandColors } from '@/store/theme';
import { colors } from '@/theme/tokens';

const FT = /^FT[A-Z0-9]{10}$/;
const TELEBIRR = /^[A-Z0-9]{10}$/;

type Method = 'CBE' | 'TEL';

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
  const [reference, setReference] = useState('');
  const [last8, setLast8] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [payKey] = useState(newIdempotencyKey);
  const [method, setMethod] = useState<Method>('CBE');

  const plan: Plan = params.plan === 'restaurant' ? 'restaurant' : 'normal';
  const period: BillingPeriod =
    plan === 'restaurant' ? 'monthly' : params.period === 'quarterly' ? 'quarterly' : 'monthly';

  const info = useQuery({ queryKey: ['subscription-payment-info'], queryFn: getPaymentInfo });

  const pay = useMutation({
    mutationFn: (receipt: { url: string } | { telebirrNumber: string }) =>
      payForPlan(plan, period, receipt, payKey),
    onSuccess: ({ check, subscription }) => {
      if (subscription) {
        setSubscription(subscription);
        router.replace('/subscription-started');
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

  // The receipt screenshot: its QR gives the whole link; otherwise read the FT reference.
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
      if (method === 'CBE') {
        const codes = await scanFromURLAsync(asset.uri, ['qr']).catch(() => []);
        const link = codes.map((c) => c.data.trim()).find(isCbeReceiptLink);
        if (link) {
          setReading(false);
          pay.mutate({ url: link });
          return;
        }
      }
      if (asset.base64) {
        const read = await readReference(asset.base64, method);
        if (read.reference) setReference(read.reference);
      }
    } catch (e) {
      setError(t(errorMessageKey(e)));
    } finally {
      setReading(false);
    }
  };

  const ready =
    method === 'TEL' ? TELEBIRR.test(reference) : FT.test(reference) && /^\d{8}$/.test(last8);

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

          {payTo.telebirr ? (
            <View className="flex-row gap-2" accessibilityRole="radiogroup">
              {(['CBE', 'TEL'] as const).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => {
                    setMethod(m);
                    setReference('');
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: method === m }}
                  className={`h-12 flex-1 flex-row items-center justify-center gap-2 rounded-[24px] ${
                    method === m ? 'bg-primary' : 'border-2 border-borderStrong bg-surface'
                  }`}
                >
                  <Text
                    font="bold"
                    tone={method === m ? 'inverse' : 'default'}
                    className="text-base"
                  >
                    {t(m === 'CBE' ? 'subscriptionPay.bank' : 'subscriptionPay.telebirr')}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View className="gap-1">
            <Text font="bold" className="text-[17px]">
              {t('subscriptionPay.step1')}
            </Text>
            <View className="flex-row items-center gap-3 rounded-[18px] border-[1.5px] border-border bg-surface p-3">
              <BankBadge code={method === 'TEL' ? 'TEL' : 'CBE'} size={44} />
              <View className="min-w-0 flex-1">
                <Text font="heading" className="text-xl" selectable>
                  {method === 'TEL' ? payTo.telebirr?.number : payTo.accountNumber}
                </Text>
                <Text tone="muted" className="text-sm" numberOfLines={1}>
                  {method === 'TEL'
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
            <Text tone="muted" className="text-sm">
              {t('subscriptionPay.orType')}
            </Text>
            <TextInput
              value={reference}
              onChangeText={(v) =>
                setReference(
                  v
                    .replace(/\s/g, '')
                    .toUpperCase()
                    .slice(0, method === 'TEL' ? 10 : 12)
                )
              }
              placeholder={method === 'TEL' ? 'DJD2QW8XTE' : 'FT26286JZH4B'}
              placeholderTextColor={colors.placeholder}
              autoCapitalize="characters"
              autoCorrect={false}
              accessibilityLabel={t(
                method === 'TEL' ? 'subscriptionPay.telebirrNumber' : 'subscriptionPay.reference'
              )}
              className="h-14 rounded-input border-[1.5px] border-borderStrong bg-surface px-4 font-heading text-xl text-text"
            />
            {method === 'CBE' ? (
              <TextInput
                value={last8}
                onChangeText={(v) => setLast8(v.replace(/\D/g, '').slice(0, 8))}
                placeholder={t('subscriptionPay.last8')}
                placeholderTextColor={colors.placeholder}
                keyboardType="number-pad"
                accessibilityLabel={t('subscriptionPay.last8')}
                className="h-14 rounded-input border-[1.5px] border-borderStrong bg-surface px-4 font-heading text-xl text-text"
              />
            ) : null}
          </View>
        </View>
      )}

      <View className="min-h-6 flex-1" />
      {payTo ? (
        <View className="px-4 pb-6 pt-2">
          <Button
            label={t('subscriptionPay.check')}
            icon={Landmark}
            disabled={!ready}
            onPress={() =>
              pay.mutate(
                method === 'TEL'
                  ? { telebirrNumber: reference }
                  : { url: cbeReceiptLink(reference, last8) }
              )
            }
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
