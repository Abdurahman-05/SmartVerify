import { Redirect, useRouter } from 'expo-router';
import { Image as ImageIcon, Info, QrCode } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BankBadge } from '@/components/ui/BankBadge';
import { Button } from '@/components/ui/Button';
import { formatMoney } from '@/components/ui/MoneyText';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { useBrandColors } from '@/store/theme';

import { findPayerBank, type ReceiptField } from './payerBanks';
import { useReceiptFlow } from './receiptFlow';
import { useVerifyFlow } from './verifyFlow';
import { VerifySteps } from './VerifySteps';

/** A grey line standing for receipt text we do not need. */
function Line({ width }: { width: `${number}%` }) {
  return <View className="h-[9px] rounded-full bg-border" style={{ width }} />;
}

function Highlight({ n, field }: { n: number; field: ReceiptField }) {
  const { t } = useTranslation();
  const sample = field.key === 'payerAccount' ? `••••${field.sample}` : field.sample;
  return (
    <View className="flex-row items-center gap-3 rounded-[14px] border-[2.5px] border-amber bg-tipBg px-3 py-2">
      <View className="h-8 w-8 items-center justify-center rounded-full bg-primary">
        <Text font="heading" tone="inverse" className="text-[17px]">
          {n}
        </Text>
      </View>
      <View className="min-w-0 flex-1">
        <Text font="bold" className="text-sm text-warnFg">
          {t(`verifyBank.fields.${field.key}`)}
        </Text>
        <Text font="heading" className="text-lg" numberOfLines={1}>
          {sample}
        </Text>
      </View>
    </View>
  );
}

/** Step 2: what to find on this bank's receipt (VerifyNeedsCBE / VerifyNeedsTelebirr). */
export default function ReceiptGuideScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const brand = useBrandColors();
  const amount = useVerifyFlow((s) => s.amount);
  const bank = findPayerBank(useReceiptFlow((s) => s.bankCode));

  if (!bank || amount <= 0) return <Redirect href="/verify-bank" />;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/verify-bank'));
  const count = bank.fields.length;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader
        title={t('verifyBank.title')}
        subtitle={t('verifyBank.findThings', { count })}
        onBack={goBack}
      />
      <VerifySteps current={2} />

      <ScrollView contentContainerStyle={{ gap: 12, padding: 16 }}>
        <View className="flex-row items-center gap-3 rounded-[18px] border-[1.5px] border-border bg-surface p-3">
          <BankBadge code={bank.code} size={44} />
          <View className="min-w-0 flex-1">
            <Text font="semibold" tone="muted" className="text-sm">
              {t('verifyBank.customersBank')}
            </Text>
            <Text font="bold" className="text-lg" numberOfLines={1}>
              {bank.name}
            </Text>
          </View>
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel={t('verifyBank.changeBank')}
            className="h-11 justify-center rounded-[22px] border-2 border-borderStrong bg-surface px-3.5 active:bg-background"
          >
            <Text font="bold" tone="link" className="text-[15px]">
              {t('verifyBank.change')}
            </Text>
          </Pressable>
        </View>

        {/* A drawn receipt with the things to find marked 1, 2… */}
        <View
          className="gap-3 rounded-[20px] border-2 border-borderStrong bg-surface p-4"
          accessible
          accessibilityLabel={bank.fields.map((f) => t(`verifyBank.fields.${f.key}`)).join(', ')}
        >
          <View className="flex-row items-center gap-2.5">
            <BankBadge code={bank.code} size={40} />
            <View className="flex-1">
              <Line width="50%" />
            </View>
            <Text font="bold" tone="muted" className="text-sm uppercase tracking-widest">
              {t('verifyBank.receipt')}
            </Text>
          </View>
          <View className="flex-row items-center justify-between">
            <Line width="30%" />
            <Text font="bold" tone="muted" className="text-base">
              {formatMoney(amount)}
            </Text>
          </View>
          {bank.fields.map((field, i) => (
            <View key={field.key} className="gap-3">
              {i === 0 && count === 1 ? <Line width="70%" /> : null}
              <Highlight n={i + 1} field={field} />
              <Line width={i === 0 && count > 1 ? '65%' : '55%'} />
            </View>
          ))}
        </View>

        <View className="flex-row items-center gap-2 px-1">
          <Info size={18} color={brand.primaryText} strokeWidth={2.2} />
          <Text tone="muted" className="flex-1 text-[15px]">
            {t('verifyBank.qrGivesAll', { count })}
          </Text>
        </View>
      </ScrollView>

      <View className="gap-2.5 px-4 pb-6 pt-2">
        <Button
          label={t('verifyBank.scanQr')}
          icon={QrCode}
          onPress={() => router.push('/verify-bank/scan')}
        />
        <Button
          label={t('verifyBank.readScreenshot')}
          icon={ImageIcon}
          variant="outline"
          size="md"
          onPress={() => router.push('/verify-bank/read')}
        />
      </View>
    </SafeAreaView>
  );
}
