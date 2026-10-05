import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ArrowLeftRight, Bike, ChevronDown, MapPin, ShoppingBag, UtensilsCrossed, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingView } from '@/components/ui/LoadingView';
import { OptionSheet } from '@/components/ui/OptionSheet';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import {
  deliveryAreas,
  getMenu,
  getTables,
  sendOrder,
  type MenuCategory,
  type OrderLine,
  type OrderNote,
  type OrderTarget,
  type OrderType,
  type Table,
} from '@/lib/api/restaurant';
import { digitsOnly, formatAmount } from '@/lib/format';
import { useSession } from '@/store/session';
import { colors } from '@/theme/tokens';

import { ConfirmSheet } from './ConfirmSheet';
import { Field } from './Field';
import { MenuItemRow } from './MenuItemRow';
import { Pill } from './Pill';
import { deliverySchema, fieldErrors, takeawaySchema } from './schemas';
import { TableSheet } from './TableSheet';

const orderTypes: { type: OrderType; icon: LucideIcon }[] = [
  { type: 'dineIn', icon: UtensilsCrossed },
  { type: 'takeaway', icon: ShoppingBag },
  { type: 'delivery', icon: Bike },
];
const categories: ('all' | MenuCategory)[] = ['all', 'food', 'drinks', 'combos'];
const kitchenNotes: OrderNote[] = ['noOnion', 'lessSpicy', 'rush', 'takeaway'];

type Sheet = 'table' | 'confirm' | 'area' | null;

function TypeButton({
  label,
  icon: Icon,
  selected,
  onPress,
}: {
  label: string;
  icon: LucideIcon;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={`h-14 flex-1 flex-row items-center justify-center gap-1.5 rounded-[18px] px-1 ${
        selected ? 'bg-primary' : 'border-2 border-borderStrong bg-surface active:bg-background'
      }`}
    >
      <Icon size={22} color={selected ? colors.surface : colors.primary} strokeWidth={2.2} />
      <Text font="bold" tone={selected ? 'inverse' : 'default'} className="text-base" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function NewOrderScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const waiterName = useSession((s) => s.user?.displayName ?? '');

  const [type, setType] = useState<OrderType>('dineIn');
  const [table, setTable] = useState<Table | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<OrderNote[]>([]);
  const [category, setCategory] = useState<'all' | MenuCategory>('all');
  const [sheet, setSheet] = useState<Sheet>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [takeaway, setTakeaway] = useState({ customerName: '', customerPhone: '' });
  const [delivery, setDelivery] = useState({
    areaId: deliveryAreas[0].id,
    fee: String(deliveryAreas[0].usualFeeEtb),
    address: '',
    customerPhone: '',
  });

  const { data: menu } = useQuery({ queryKey: ['menu'], queryFn: getMenu });
  const { data: tables } = useQuery({ queryKey: ['tables'], queryFn: getTables });

  const mutation = useMutation({
    mutationFn: sendOrder,
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      router.replace({ pathname: '/order-sent', params: { id: order.id } });
    },
  });

  if (!menu || !tables) return <LoadingView />;
  if (mutation.isPending) {
    return <LoadingView title={t('orders.sending')} subtitle={t('orders.sendingSubtitle')} />;
  }

  const area = deliveryAreas.find((a) => a.id === delivery.areaId) ?? deliveryAreas[0];
  const lines: OrderLine[] = menu
    .filter((item) => (cart[item.id] ?? 0) > 0)
    .map((item) => ({ itemId: item.id, name: item.name, priceEtb: item.priceEtb, quantity: cart[item.id] }));
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);
  const total = lines.reduce((sum, l) => sum + l.priceEtb * l.quantity, 0);
  const shownMenu = category === 'all' ? menu : menu.filter((item) => item.category === category);
  const err = (key: string) => (errors[key] ? t(errors[key]) : undefined);

  const setQuantity = (itemId: string, quantity: number) =>
    setCart((c) => ({ ...c, [itemId]: Math.max(0, quantity) }));
  const toggleNote = (note: OrderNote) =>
    setNotes((n) => (n.includes(note) ? n.filter((x) => x !== note) : [...n, note]));
  const switchType = (next: OrderType) => {
    setType(next);
    setErrors({});
  };

  const submit = (target: OrderTarget) =>
    mutation.mutate({ target, lines, notes: type === 'dineIn' ? notes : [], waiterName });

  const onSend = () => {
    if (itemCount === 0) return;
    if (type === 'dineIn') {
      setSheet(table ? 'confirm' : 'table');
      return;
    }
    if (type === 'takeaway') {
      const parsed = takeawaySchema.safeParse(takeaway);
      if (!parsed.success) return setErrors(fieldErrors(parsed.error));
      setErrors({});
      submit({
        type: 'takeaway',
        customerName: parsed.data.customerName,
        customerPhone: parsed.data.customerPhone || undefined,
      });
      return;
    }
    const parsed = deliverySchema.safeParse(delivery);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    submit({
      type: 'delivery',
      areaName: area.name,
      deliveryFeeEtb: Number(parsed.data.fee),
      usualFeeEtb: area.usualFeeEtb,
      address: parsed.data.address,
      customerPhone: parsed.data.customerPhone,
    });
  };

  const sendLabel =
    type === 'takeaway'
      ? t('orders.sendTakeaway')
      : type === 'delivery'
        ? t('orders.sendDelivery')
        : table
          ? t('orders.sendTable', { number: table.number })
          : t('orders.pickTable');

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScreenHeader
          title={t('orders.title')}
          subtitle={t('orders.waiter', { name: waiterName })}
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
        />

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 8 }}>
          <View className="flex-row gap-2 px-4 pb-2.5 pt-1" accessibilityRole="radiogroup">
            {orderTypes.map(({ type: value, icon }) => (
              <TypeButton
                key={value}
                label={t(`orders.type.${value}`)}
                icon={icon}
                selected={type === value}
                onPress={() => switchType(value)}
              />
            ))}
          </View>

          {type === 'dineIn' ? (
            <View className="mx-4 flex-row items-center justify-between gap-2 rounded-[20px] bg-primary py-3 pl-[18px] pr-3">
              <View className="flex-1">
                <Text font="semibold" tone="inverse" className="text-sm opacity-90">
                  {table ? t('orders.orderingFor', { area: t(`orders.area.${table.area}`) }) : t('orders.noTable')}
                </Text>
                <Text font="heading" tone="inverse" className="mt-0.5 text-[30px] leading-tight" numberOfLines={1}>
                  {table ? t('orders.table', { number: table.number }) : t('orders.chooseTable')}
                </Text>
              </View>
              <Pressable
                onPress={() => setSheet('table')}
                accessibilityRole="button"
                accessibilityLabel={t('orders.chooseTable')}
                className="h-[52px] flex-row items-center gap-1.5 rounded-[26px] bg-amber px-3.5 active:opacity-80"
              >
                <ArrowLeftRight size={20} color={colors.text} strokeWidth={2.4} />
                <Text font="bold" className="text-base">
                  {t('orders.change')}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {type === 'takeaway' ? (
            <View className="mx-4 gap-2.5 rounded-[20px] border-[1.5px] border-border bg-surface px-3.5 py-3">
              <Field
                label={t('orders.customerName')}
                placeholder={t('orders.customerNamePlaceholder')}
                value={takeaway.customerName}
                onChangeText={(customerName) => setTakeaway((v) => ({ ...v, customerName }))}
                autoCapitalize="words"
                error={err('customerName')}
              />
              <Field
                label={t('orders.customerPhoneOptional')}
                placeholder={t('orders.phonePlaceholder')}
                value={takeaway.customerPhone}
                onChangeText={(text) => setTakeaway((v) => ({ ...v, customerPhone: digitsOnly(text, 10) }))}
                keyboardType="phone-pad"
                maxLength={10}
                error={err('customerPhone')}
              />
            </View>
          ) : null}

          {type === 'delivery' ? (
            <View className="mx-4 gap-2.5 rounded-[20px] border-[1.5px] border-border bg-surface px-3.5 py-3">
              <View className="flex-row items-start gap-2.5">
                <View className="min-w-0 flex-1 gap-1">
                  <Text font="bold" className="text-[15px]">
                    {t('orders.deliveryArea')}
                  </Text>
                  <Pressable
                    onPress={() => setSheet('area')}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('orders.deliveryArea')}: ${area.name}`}
                    className="h-[50px] flex-row items-center gap-2 rounded-[14px] border-2 border-primary bg-surface px-3 active:bg-background"
                  >
                    <MapPin size={22} color={colors.primary} strokeWidth={2.2} />
                    <Text font="bold" className="flex-1 text-[17px]" numberOfLines={1}>
                      {area.name}
                    </Text>
                    <ChevronDown size={22} color={colors.text} strokeWidth={2} />
                  </Pressable>
                </View>
                <View className="w-32">
                  <Field
                    label={t('orders.fee')}
                    value={delivery.fee}
                    onChangeText={(text) => setDelivery((v) => ({ ...v, fee: digitsOnly(text, 4) }))}
                    keyboardType="number-pad"
                    maxLength={4}
                    emphasis
                    error={err('fee')}
                  />
                </View>
              </View>
              <Text font="semibold" tone="muted" className="-mt-1 text-sm">
                {t('orders.feeNote', { area: area.name, fee: area.usualFeeEtb })}
              </Text>
              <Field
                label={t('orders.address')}
                placeholder={t('orders.addressPlaceholder')}
                value={delivery.address}
                onChangeText={(address) => setDelivery((v) => ({ ...v, address }))}
                error={err('address')}
              />
              <Field
                label={t('orders.customerPhone')}
                placeholder={t('orders.phonePlaceholder')}
                value={delivery.customerPhone}
                onChangeText={(text) => setDelivery((v) => ({ ...v, customerPhone: digitsOnly(text, 10) }))}
                keyboardType="phone-pad"
                maxLength={10}
                error={err('customerPhone')}
              />
            </View>
          ) : null}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 }}
            accessibilityRole="radiogroup"
          >
            {categories.map((c) => (
              <Pill key={c} label={t(`orders.category.${c}`)} selected={category === c} onPress={() => setCategory(c)} />
            ))}
          </ScrollView>

          <View className="gap-2 px-4">
            {shownMenu.map((item) => (
              <MenuItemRow
                key={item.id}
                item={item}
                quantity={cart[item.id] ?? 0}
                onChange={(q) => setQuantity(item.id, q)}
              />
            ))}
          </View>

          {type === 'dineIn' ? (
            <View className="px-4 pb-1.5 pt-2.5">
              <Text font="bold" className="mb-1.5 text-[15px]">
                {t('orders.tellKitchen')}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {kitchenNotes.map((note) => (
                  <Pill
                    key={note}
                    role="checkbox"
                    label={t(`orders.note.${note}`)}
                    selected={notes.includes(note)}
                    onPress={() => toggleNote(note)}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View className="px-4 pb-2.5 pt-1.5">
          {mutation.isError ? (
            <Text font="semibold" className="pb-2 text-center text-base text-dangerFg">
              {t('orders.sendFailed')}
            </Text>
          ) : itemCount === 0 ? (
            <Text font="semibold" tone="muted" className="pb-2 text-center text-[15px]">
              {t('orders.emptyCart')}
            </Text>
          ) : null}
          <Pressable
            onPress={onSend}
            disabled={itemCount === 0}
            accessibilityRole="button"
            accessibilityState={{ disabled: itemCount === 0 }}
            accessibilityLabel={`${t('orders.items', { count: itemCount })}, ${formatAmount(total)} ${t('common.etb')}. ${sendLabel}`}
            className={`h-[68px] flex-row items-center justify-between rounded-[20px] bg-primary px-5 ${
              itemCount === 0 ? 'opacity-50' : 'active:opacity-80'
            }`}
          >
            <View>
              <Text font="semibold" tone="inverse" className="text-sm opacity-90">
                {t('orders.items', { count: itemCount })}
              </Text>
              <Text font="heading" tone="inverse" className="text-[22px]">
                {formatAmount(total)} {t('common.etb')}
              </Text>
            </View>
            <View className="items-end">
              {type === 'dineIn' && table ? (
                <Text font="semibold" tone="inverse" className="text-sm opacity-90">
                  {t('orders.sendTo')}
                </Text>
              ) : null}
              <Text font="bold" tone="inverse" className="text-lg">
                {sendLabel}
              </Text>
            </View>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <TableSheet
        visible={sheet === 'table'}
        tables={tables}
        currentId={table?.id ?? null}
        onSelect={setTable}
        onClose={() => setSheet(null)}
      />
      {table ? (
        <ConfirmSheet
          visible={sheet === 'confirm'}
          tableNumber={table.number}
          lines={lines}
          total={total}
          onConfirm={() => {
            setSheet(null);
            submit({ type: 'dineIn', tableId: table.id, tableNumber: table.number, area: table.area });
          }}
          onChangeTable={() => setSheet('table')}
          onClose={() => setSheet(null)}
        />
      ) : null}
      <OptionSheet
        visible={sheet === 'area'}
        title={t('orders.chooseArea')}
        options={deliveryAreas.map((a) => ({ value: a.id, label: `${a.name} · ${a.usualFeeEtb} ${t('common.etb')}` }))}
        selected={delivery.areaId}
        onSelect={(areaId) => {
          const next = deliveryAreas.find((a) => a.id === areaId) ?? deliveryAreas[0];
          setDelivery((v) => ({ ...v, areaId, fee: String(next.usualFeeEtb) }));
        }}
        onClose={() => setSheet(null)}
      />
    </SafeAreaView>
  );
}
