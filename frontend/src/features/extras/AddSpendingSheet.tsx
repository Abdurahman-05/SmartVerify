import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Banknote,
  Check,
  Coffee,
  Ellipsis,
  Flame,
  House,
  Landmark,
  ReceiptText,
  Soup,
  Tag,
  Truck,
  Wallet,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, Pressable, ScrollView, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { useGlass } from '@/components/ui/glassTokens';
import { HeroCard } from '@/components/ui/HeroCard';
import { Input } from '@/components/ui/Input';
import { formatMoney } from '@/components/ui/MoneyText';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Segmented } from '@/components/ui/Segmented';
import { Text } from '@/components/ui/Text';
import { TopBar } from '@/components/ui/TopBar';
import { errorMessageKey } from '@/lib/errors';
import { digitsOnly } from '@/lib/format';
import {
  addExpense,
  changeExpense,
  costKindsKey,
  defaultCostKinds,
  expenseCategories,
  getCostKinds,
  spendingsKey,
  type Expense,
  type ExpenseCategory,
  type NewExpense,
  type PaidFrom,
} from '@/lib/extras';
import { useSession } from '@/store/session';
import { colors } from '@/theme/tokens';

// Design: docs/design/owner/screens/05-add-money-out.png
const MAX_AMOUNT_DIGITS = 7;

/**
 * Purchase = things you cook or sell with; expense = the owner's business-cost kinds (rent, gas,
 * salary...). The kind only decides which categories are offered; the category is what is saved.
 */
export type SpendingKind = 'purchase' | 'expense';

const categoryIcons: Record<ExpenseCategory, LucideIcon> = {
  FOOD: Soup,
  DRINKS: Coffee,
  GAS: Flame,
  RENT: House,
  SALARY: Wallet,
  REPAIRS: Wrench,
  TRANSPORT: Truck,
  BILLS: ReceiptText,
  OTHER: Ellipsis,
};

/** A choice pill or tile: selected = 2 px theme border, tile background, theme text. */
function Choice({
  label,
  icon: Icon,
  selected,
  onPress,
  tall,
}: {
  label: string;
  icon?: LucideIcon;
  selected: boolean;
  onPress: () => void;
  tall?: boolean;
}) {
  const g = useGlass();
  const fg = selected ? g.primaryText : colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      className={`flex-1 items-center justify-center active:opacity-80 ${
        tall ? 'h-16 gap-0.5 rounded-[18px] px-1' : 'h-12 flex-row gap-2 rounded-[24px] px-3'
      }`}
      style={{
        backgroundColor: selected ? g.tile : 'rgba(255,255,255,0.55)',
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? g.primary : 'rgba(255,255,255,0.9)',
      }}
    >
      {Icon ? <Icon size={tall ? 20 : 18} color={fg} strokeWidth={2.2} /> : null}
      <Text
        font="bold"
        className={tall ? 'text-[13px]' : 'text-[15px]'}
        style={{ color: fg }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function rows<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Add money out: purchase or expense, the amount, what it was, its kind and where it came from.
 * With `editing` the owner corrects that expense instead (the server keeps the change on it).
 */
export function AddSpendingSheet({
  visible,
  onClose,
  editing,
  initialKind = 'purchase',
}: {
  visible: boolean;
  onClose: () => void;
  editing?: Expense;
  initialKind?: SpendingKind;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isOwner = useSession((st) => st.user?.role === 'owner');
  const { data: costKinds = defaultCostKinds } = useQuery({
    queryKey: costKindsKey,
    queryFn: getCostKinds,
    enabled: visible,
  });
  const [kind, setKind] = useState<SpendingKind>(
    editing ? (costKinds.includes(editing.category) ? 'expense' : 'purchase') : initialKind
  );
  const [title, setTitle] = useState(editing?.title ?? '');
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '');
  const [category, setCategory] = useState<ExpenseCategory>(editing?.category ?? 'FOOD');
  const [paidFrom, setPaidFrom] = useState<PaidFrom>(editing?.paidFrom ?? 'CASH');
  const [hasReceipt, setHasReceipt] = useState(editing?.hasReceipt ?? true);
  const [forBusiness, setForBusiness] = useState(editing?.forBusiness ?? true);
  const [errors, setErrors] = useState<{ title?: boolean; amount?: boolean }>({});

  const shown = expenseCategories.filter((c) => costKinds.includes(c) === (kind === 'expense'));
  const kinds = shown.length ? shown : expenseCategories;
  // Switching purchase/expense keeps the category only when it is still offered.
  const chosen = kinds.includes(category) ? category : kinds[0];

  const save = useMutation({
    mutationFn: (input: NewExpense) =>
      editing ? changeExpense(editing.id, input) : addExpense(input),
    onSuccess: () => {
      // Lists, the one expense and the money flow all start with these keys.
      void queryClient.invalidateQueries({ queryKey: spendingsKey });
      void queryClient.invalidateQueries({ queryKey: ['money-flow'] });
      if (editing) {
        onClose();
        return;
      }
      setTitle('');
      setAmount('');
      setCategory('FOOD');
      setPaidFrom('CASH');
      setHasReceipt(true);
      setForBusiness(true);
      onClose();
    },
  });

  const submit = () => {
    Keyboard.dismiss();
    const next = { title: !title.trim(), amount: Number(amount) < 1 };
    setErrors(next);
    if (next.title || next.amount) return;
    save.mutate({
      title: title.trim(),
      amount: Number(amount),
      category: chosen,
      paidFrom,
      hasReceipt,
      forBusiness,
    });
  };

  const label = (text: string) => (
    <Text font="bold" className="px-1 text-sm" style={{ color: colors.muted }}>
      {text}
    </Text>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14 }}>
        <TopBar
          title={t(editing ? 'extras.money.changeTitle' : 'extras.money.outTitle')}
          subtitle={t('extras.money.taxNote')}
          left={{ icon: X, onPress: onClose, label: t('common.cancel') }}
        />

        <Segmented
          options={[
            { value: 'purchase', label: t('extras.money.purchase') },
            { value: 'expense', label: t('extras.money.expense') },
          ]}
          value={kind}
          onChange={setKind}
        />

        <HeroCard style={{ alignItems: 'center' }}>
          <Text font="bold" tone="inverse" className="text-[13px] uppercase opacity-90">
            {t('extras.money.amountPaid')}
          </Text>
          <View className="flex-row items-baseline justify-center gap-2">
            <TextInput
              accessibilityLabel={t('extras.money.amount')}
              placeholder="0"
              placeholderTextColor="rgba(255,255,255,0.6)"
              value={amount ? formatMoney(Number(amount), false) : ''}
              onChangeText={(text) => {
                setAmount(digitsOnly(text, MAX_AMOUNT_DIGITS));
                setErrors((e) => ({ ...e, amount: false }));
              }}
              keyboardType="number-pad"
              className="min-w-16 text-center font-heading text-[42px] text-white"
            />
            <Text font="heading" tone="inverse" className="text-lg">
              {t('common.etb')}
            </Text>
          </View>
          <Text tone="inverse" className="text-center text-sm opacity-90">
            {t(kind === 'purchase' ? 'extras.money.purchaseHint' : 'extras.money.expenseHint')}
          </Text>
        </HeroCard>
        {errors.amount ? (
          <Text font="semibold" className="-mt-1.5 px-1 text-[15px] text-dangerFg">
            {t('extras.errors.amount')}
          </Text>
        ) : null}

        <Input
          round
          label={t(kind === 'purchase' ? 'extras.money.whatBought' : 'extras.money.whatPaid')}
          labelIcon={Tag}
          placeholder={t('extras.money.whatPlaceholder')}
          value={title}
          onChangeText={(text) => {
            setTitle(text);
            setErrors((e) => ({ ...e, title: false }));
          }}
          maxLength={80}
          error={errors.title ? t('extras.errors.title') : undefined}
        />

        <View className="gap-1.5">
          {label(t('extras.money.kind'))}
          <View className="gap-2" accessibilityRole="radiogroup">
            {rows(kinds, 4).map((row) => (
              <View key={row[0]} className="flex-row gap-2">
                {row.map((c) => (
                  <Choice
                    tall
                    key={c}
                    icon={categoryIcons[c]}
                    label={t(`extras.money.categories.${c}`)}
                    selected={chosen === c}
                    onPress={() => setCategory(c)}
                  />
                ))}
                {Array.from({ length: 4 - row.length }, (_, i) => (
                  <View key={i} className="flex-1" />
                ))}
              </View>
            ))}
          </View>
        </View>

        <View className="gap-1.5">
          {label(t('extras.money.paidFrom'))}
          <View className="flex-row gap-2" accessibilityRole="radiogroup">
            <Choice
              icon={Banknote}
              label={t('extras.cash')}
              selected={paidFrom === 'CASH'}
              onPress={() => setPaidFrom('CASH')}
            />
            <Choice
              icon={Landmark}
              label={t('extras.bank')}
              selected={paidFrom === 'BANK'}
              onPress={() => setPaidFrom('BANK')}
            />
          </View>
        </View>
        <View className="gap-1.5">
          {label(t('extras.money.receipt'))}
          <View className="flex-row gap-2" accessibilityRole="radiogroup">
            <Choice
              label={t('extras.money.hasReceipt')}
              selected={hasReceipt}
              onPress={() => setHasReceipt(true)}
            />
            <Choice
              label={t('extras.money.noReceipt')}
              selected={!hasReceipt}
              onPress={() => setHasReceipt(false)}
            />
          </View>
        </View>
        <View className="gap-1.5">
          {label(t('extras.money.usedFor'))}
          <View className="flex-row gap-2" accessibilityRole="radiogroup">
            <Choice
              label={t('extras.money.forBusiness')}
              selected={forBusiness}
              onPress={() => setForBusiness(true)}
            />
            <Choice
              label={t('extras.money.personal')}
              selected={!forBusiness}
              onPress={() => setForBusiness(false)}
            />
          </View>
        </View>

        <PrimaryButton
          icon={Check}
          label={t(
            editing
              ? 'common.save'
              : kind === 'purchase'
                ? 'extras.money.savePurchase'
                : 'extras.money.saveExpense'
          )}
          loading={save.isPending}
          onPress={submit}
        />
        {editing || isOwner ? null : (
          <Text tone="muted" className="text-center text-sm">
            {t('extras.money.ownerTold')}
          </Text>
        )}
      </ScrollView>

      <ErrorDialog
        visible={save.isError}
        title={t('extras.money.failedTitle')}
        message={t(errorMessageKey(save.error))}
        actionLabel={t('errors.retry')}
        onClose={save.reset}
      />
    </BottomSheet>
  );
}
