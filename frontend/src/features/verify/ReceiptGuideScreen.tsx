import { Redirect, useRouter } from 'expo-router';
import {
  ArrowRight,
  ChevronLeft,
  ClipboardPaste,
  Image as ImageIcon,
  ScanLine,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BankBadge } from '@/components/ui/BankBadge';
import { GhostButton } from '@/components/ui/GhostButton';
import { GlassCard } from '@/components/ui/GlassCard';
import { useGlass } from '@/components/ui/glassTokens';
import { HeroCard, HeroChip } from '@/components/ui/HeroCard';
import { formatMoney } from '@/components/ui/MoneyText';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { Text } from '@/components/ui/Text';
import { TopBar } from '@/components/ui/TopBar';
import { colors } from '@/theme/tokens';

import { findPayerBank, onReceipt, type ReceiptField } from './payerBanks';
import { useReceiptFlow } from './receiptFlow';
import { useVerifyFlow } from './verifyFlow';
import { VerifySteps } from './VerifySteps';

// Design: docs/design/owner/verify-handoff/screens/13-receipt.png

/** One thing to find on the receipt, as a see-through chip in the hero. */
function FieldChip({ n, field }: { n: number; field: ReceiptField }) {
  const { t } = useTranslation();
  return (
    <HeroChip style={{ flex: 1, minWidth: 0 }}>
      <Text font="bold" tone="inverse" className="text-[13px] opacity-90">
        {n}
      </Text>
      <Text font="bold" tone="inverse" className="text-base leading-5">
        {t(`verifyBank.fields.${field.key}`)}
      </Text>
      <Text tone="inverse" className="text-[13px] opacity-85" numberOfLines={1}>
        {field.sample}
      </Text>
    </HeroChip>
  );
}

/** White pill inside the hero: the main way to read the receipt. */
function WhitePill({
  label,
  icon: Icon,
  onPress,
}: {
  label: string;
  icon: typeof ScanLine;
  onPress: () => void;
}) {
  const g = useGlass();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="mt-3 h-14 flex-row items-center justify-center gap-2.5 rounded-[28px] bg-white active:opacity-85"
    >
      <Icon size={22} color={g.primaryText} strokeWidth={2.2} />
      <Text font="bold" className="text-[17px]" style={{ color: g.primaryText }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Step 2: what to find on this bank's receipt, and the ways to read it (or type it). */
export default function ReceiptGuideScreen() {
  const { t } = useTranslation();
  const g = useGlass();
  const router = useRouter();
  const amount = useVerifyFlow((s) => s.amount);
  const bank = findPayerBank(useReceiptFlow((s) => s.bankCode));
  const setFound = useReceiptFlow((s) => s.setFound);
  const [typed, setTyped] = useState('');

  if (!bank || amount <= 0) return <Redirect href="/verify-bank" />;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/verify-bank'));
  // Typed fields (not on the receipt) are asked for later, on the confirm page.
  const fields = onReceipt(bank);
  const count = fields.length;
  const first = fields[0];
  // Typing the first thing (e.g. the transaction ID) goes to the confirm page, which asks for
  // anything still missing.
  const submitTyped = () => {
    const value = typed.trim();
    if (!first || !value) return;
    setFound({ [first.key]: value });
    router.push('/verify-bank/found');
  };

  return (
    <ScreenBackground>
      <SafeAreaView edges={['top']} className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          <View className="px-4 pb-3 pt-2">
            <TopBar
              title={t('verifyBank.title')}
              subtitle={`${t('verifyBank.payByBank')} · ${formatMoney(amount)}`}
              left={{ icon: ChevronLeft, onPress: goBack, label: t('common.back') }}
            />
          </View>
          <VerifySteps current={2} />

          <ScrollView
            contentContainerStyle={{ gap: 12, padding: 16, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            <GlassCard style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
              <BankBadge code={bank.code} size={44} />
              <View className="min-w-0 flex-1">
                <Text className="text-sm" style={{ color: colors.muted }}>
                  {t('verifyBank.customersBank')}
                </Text>
                <Text font="bold" className="text-base" numberOfLines={2}>
                  {bank.name}
                </Text>
              </View>
              <Pressable
                onPress={goBack}
                accessibilityRole="button"
                accessibilityLabel={t('verifyBank.changeBank')}
                hitSlop={6}
                className="h-11 justify-center px-2 active:opacity-70"
              >
                <Text font="bold" className="text-[15px]" style={{ color: g.primaryText }}>
                  {t('verifyBank.change')}
                </Text>
              </Pressable>
            </GlassCard>

            <HeroCard>
              <Text
                font="bold"
                tone="inverse"
                className="text-[13px] uppercase tracking-[0.6px] opacity-90"
                accessibilityRole="header"
              >
                {t('verifyBank.findThings', { count })}
              </Text>
              <View
                className="mt-3 flex-row gap-2"
                accessible
                accessibilityLabel={fields.map((f) => t(`verifyBank.fields.${f.key}`)).join(', ')}
              >
                {fields.map((field, i) => (
                  <FieldChip key={field.key} n={i + 1} field={field} />
                ))}
              </View>
              {bank.hasQr ? (
                <WhitePill
                  label={t('verifyBank.scanQr')}
                  icon={ScanLine}
                  onPress={() => router.push('/verify-bank/scan')}
                />
              ) : (
                <WhitePill
                  label={t('verifyBank.readScreenshot')}
                  icon={ImageIcon}
                  onPress={() => router.push('/verify-bank/read')}
                />
              )}
              <Text tone="inverse" className="mt-2 text-center text-[13px] opacity-90">
                {t(bank.hasQr ? 'verifyBank.qrGivesAll' : 'verifyBank.photoGivesAll', { count })}
              </Text>
            </HeroCard>

            {bank.hasQr ? (
              bank.noPicture ? (
                // CBE Birr: the SMS is pasted on the next page; no picture is read.
                <GhostButton
                  label={t('verifyBank.pasteSms')}
                  icon={ClipboardPaste}
                  onPress={() => {
                    setFound({});
                    router.push('/verify-bank/found');
                  }}
                />
              ) : (
                <GhostButton
                  label={t('verifyBank.readScreenshot')}
                  icon={ImageIcon}
                  onPress={() => router.push('/verify-bank/read')}
                />
              )
            ) : null}

            {first && !bank.noPicture ? (
              <>
                <View className="flex-row items-center gap-3 py-1">
                  <View className="h-px flex-1 bg-black/10" />
                  <Text
                    font="bold"
                    className="text-[13px] uppercase tracking-[0.6px]"
                    style={{ color: colors.muted }}
                  >
                    {t('verifyBank.orTypeIt')}
                  </Text>
                  <View className="h-px flex-1 bg-black/10" />
                </View>
                <Text font="bold" className="px-1 text-sm" style={{ color: colors.muted }}>
                  {t(`verifyBank.fields.${first.key}`)}
                </Text>
                <View
                  className="h-14 flex-row items-center gap-2 rounded-[28px] pl-5 pr-1.5"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.85)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.95)',
                  }}
                >
                  <TextInput
                    value={typed}
                    onChangeText={setTyped}
                    onSubmitEditing={submitTyped}
                    returnKeyType="next"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    placeholder={`${first.sample.slice(0, 4)}…`}
                    placeholderTextColor={colors.placeholder}
                    accessibilityLabel={t(`verifyBank.fields.${first.key}`)}
                    className="h-full flex-1 font-heading text-lg text-text"
                  />
                  {typed.trim() ? (
                    <Pressable
                      onPress={submitTyped}
                      accessibilityRole="button"
                      accessibilityLabel={t('verifyBank.useTyped')}
                      className="h-11 w-11 items-center justify-center rounded-full active:opacity-80"
                      style={{ backgroundColor: g.primaryDeep }}
                    >
                      <ArrowRight size={20} color="#FFFFFF" strokeWidth={2.4} />
                    </Pressable>
                  ) : null}
                </View>
              </>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenBackground>
  );
}
