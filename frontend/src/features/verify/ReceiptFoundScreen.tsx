import { Redirect, useRouter } from 'expo-router';
import { CircleCheck, Pencil, RotateCcw } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { FormScreen } from '@/components/ui/FormScreen';
import { formatMoney } from '@/components/ui/MoneyText';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { colors } from '@/theme/tokens';

import { findPayerBank, type ReceiptField } from './payerBanks';
import { useReceiptFlow, type ReceiptValues } from './receiptFlow';
import { useVerifyFlow } from './verifyFlow';

function FoundValue({ field, value }: { field: ReceiptField; value: string }) {
  const { t } = useTranslation();
  return (
    <View
      className="gap-1 rounded-[20px] border-[2.5px] border-primary bg-surface px-4 py-3"
      accessible
    >
      <View className="flex-row items-center gap-1.5">
        <CircleCheck size={18} color={colors.primaryText} strokeWidth={2.4} />
        <Text font="bold" tone="link" className="text-[15px]">
          {t('verifyBank.found.found', { field: t(`verifyBank.short.${field.key}`) })}
        </Text>
      </View>
      <Text font="heading" className="text-[26px]" selectable>
        {value}
      </Text>
    </View>
  );
}

function MissingValue({
  field,
  value,
  onChange,
}: {
  field: ReceiptField;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const label = t('verifyBank.found.typeIt', { field: t(`verifyBank.short.${field.key}`) });
  const wrong = value.length > 0 && !field.valid(value) && value.length >= (field.length ?? 8);
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center gap-1.5">
        <Pencil size={16} color={colors.warnFg} strokeWidth={2.4} />
        <Text font="bold" className="text-[15px] text-warnFg">
          {label}
        </Text>
      </View>
      <View
        className={`h-[68px] justify-center rounded-[18px] border-[3px] bg-surface px-4 ${
          wrong ? 'border-dangerFg' : 'border-amber'
        }`}
      >
        <TextInput
          value={value}
          onChangeText={(text) => onChange(field.normalize(text).slice(0, field.length ?? 20))}
          keyboardType={field.input === 'digits' ? 'number-pad' : 'default'}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={field.length ?? 20}
          placeholder={
            field.length
              ? t('verifyBank.found.digits', { count: field.length })
              : t('verifyBank.found.typeHere')
          }
          placeholderTextColor={colors.placeholder}
          accessibilityLabel={label}
          className="font-heading text-[28px] text-text"
        />
      </View>
      {wrong ? (
        <Text font="semibold" className="text-[15px] text-dangerFg">
          {t('verifyBank.found.wrong')}
        </Text>
      ) : null}
    </View>
  );
}

/** Step 3: confirm what was found, type what is missing (VerifyReceiptFound). */
export default function ReceiptFoundScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const amount = useVerifyFlow((s) => s.amount);
  const setQrData = useVerifyFlow((s) => s.setQrData);
  const bank = findPayerBank(useReceiptFlow((s) => s.bankCode));
  const found = useReceiptFlow((s) => s.found);
  const [typed, setTyped] = useState<ReceiptValues>({});

  if (!bank || amount <= 0) return <Redirect href="/verify-bank" />;

  const valueOf = (field: ReceiptField) => found[field.key] ?? typed[field.key] ?? '';
  const ready = bank.fields.every((f) => f.valid(valueOf(f)));

  const check = () => {
    const values = Object.fromEntries(bank.fields.map((f) => [f.key, valueOf(f)]));
    // The checking screen sends this to the (for now fake) bank check.
    setQrData(JSON.stringify({ bank: bank.code, ...values }));
    router.replace('/verify-restaurant/checking');
  };

  return (
    <FormScreen>
      <ScreenHeader
        title={t('verifyBank.found.title')}
        subtitle={`${bank.shortName} · ${formatMoney(amount)}`}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/verify-bank/receipt'))}
      />

      <View className="gap-4 px-4 pt-3">
        {bank.fields.map((field) =>
          found[field.key] ? (
            <FoundValue key={field.key} field={field} value={found[field.key] ?? ''} />
          ) : (
            <MissingValue
              key={field.key}
              field={field}
              value={typed[field.key] ?? ''}
              onChange={(value) => setTyped((v) => ({ ...v, [field.key]: value }))}
            />
          )
        )}
      </View>

      <View className="min-h-6 flex-1" />

      <View className="gap-2.5 px-4 pb-6 pt-2">
        <Button
          label={t('verifyBank.found.check', { amount: formatMoney(amount) })}
          disabled={!ready}
          onPress={check}
        />
        <Button
          label={t('verifyBank.found.readAgain')}
          icon={RotateCcw}
          variant="outline"
          size="md"
          onPress={() => router.replace('/verify-bank/read')}
        />
      </View>
    </FormScreen>
  );
}
