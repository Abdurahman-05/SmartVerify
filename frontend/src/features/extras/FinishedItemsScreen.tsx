import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { CircleCheck, Plus, Send, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Keyboard, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { Input } from '@/components/ui/Input';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { Pill } from '@/features/orders/Pill';
import { errorMessageKey } from '@/lib/errors';
import {
  addBuyItem,
  buyItemsKey,
  getBuyItems,
  removeBuyItem,
  type BuyItem,
  type BuyWhen,
  type NewBuyItem,
} from '@/lib/extras';
import { useSession } from '@/store/session';
import { colors } from '@/theme/tokens';

import { FeatureGate } from './FeatureGate';

type Draft = NewBuyItem & { key: number };

/** A line of the list: name, amount and when, with an optional remove button. */
function ItemLine({
  name,
  qty,
  when,
  removeLabel,
  onRemove,
}: {
  name: string;
  qty: string | null | undefined;
  when: BuyWhen;
  removeLabel?: string;
  onRemove?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-2 rounded-[16px] border-[1.5px] border-border bg-surface py-2 pl-3.5 pr-2">
      <View className="min-w-0 flex-1">
        <Text font="bold" className="text-base" numberOfLines={1}>
          {name}
        </Text>
        <Text tone="muted" className="text-sm" numberOfLines={1}>
          {[qty, t(when === 'TODAY' ? 'extras.finished.today' : 'extras.finished.week')]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={removeLabel}
          className="h-11 w-11 items-center justify-center rounded-[12px] active:bg-dangerBg"
        >
          <X size={22} color={colors.dangerFg} strokeWidth={2.4} />
        </Pressable>
      ) : null}
    </View>
  );
}

function FinishedItems() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const myName = useSession((s) => s.user?.displayName);

  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [when, setWhen] = useState<BuyWhen>('TODAY');
  const [nameError, setNameError] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [sentCount, setSentCount] = useState(0);

  const open = useQuery({ queryKey: [...buyItemsKey, 'OPEN'], queryFn: () => getBuyItems('OPEN') });
  const { refetch } = open;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  const send = useMutation({
    mutationFn: async (items: Draft[]) => {
      // One by one, so the ones that went are not sent again if a later one fails.
      for (const { key, name: itemName, qty: itemQty, when: itemWhen } of items) {
        await addBuyItem({ name: itemName, qty: itemQty, when: itemWhen });
        setDrafts((current) => current.filter((d) => d.key !== key));
      }
      return items.length;
    },
    onSuccess: (count) => setSentCount(count),
    onSettled: () => queryClient.invalidateQueries({ queryKey: buyItemsKey }),
  });
  const remove = useMutation({
    mutationFn: removeBuyItem,
    onSettled: () => queryClient.invalidateQueries({ queryKey: buyItemsKey }),
  });

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/cook'));

  const add = () => {
    Keyboard.dismiss();
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    setSentCount(0);
    setDrafts((current) => [
      ...current,
      { key: Date.now() + current.length, name: name.trim(), qty: qty.trim() || undefined, when },
    ]);
    setName('');
    setQty('');
  };

  const confirmRemove = (item: BuyItem) =>
    Alert.alert(t('extras.finished.removeTitle', { name: item.name }), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('extras.finished.removeAction'),
        style: 'destructive',
        onPress: () => remove.mutate(item.id),
      },
    ]);

  const failed = send.isError ? send : remove.isError ? remove : null;
  const mine = (open.data ?? []).filter((item) => item.createdBy === myName);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader
        title={t('extras.finished.title')}
        subtitle={t('extras.finished.subtitle')}
        onBack={goBack}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}
      >
        <Input
          label={t('extras.finished.name')}
          placeholder={t('extras.finished.namePlaceholder')}
          value={name}
          onChangeText={(text) => {
            setName(text);
            setNameError(false);
          }}
          autoCapitalize="sentences"
          maxLength={80}
          error={nameError ? t('extras.finished.nameError') : undefined}
        />
        <Input
          label={t('extras.finished.amount')}
          placeholder={t('extras.finished.amountPlaceholder')}
          value={qty}
          onChangeText={setQty}
          maxLength={40}
        />
        <View className="gap-1.5">
          <Text font="bold" className="text-base">
            {t('extras.finished.when')}
          </Text>
          <View className="flex-row gap-2" accessibilityRole="radiogroup">
            <Pill
              label={t('extras.finished.today')}
              selected={when === 'TODAY'}
              onPress={() => setWhen('TODAY')}
            />
            <Pill
              label={t('extras.finished.week')}
              selected={when === 'WEEK'}
              onPress={() => setWhen('WEEK')}
            />
          </View>
        </View>
        <Button label={t('extras.finished.add')} icon={Plus} variant="outline" onPress={add} />

        {sentCount > 0 && drafts.length === 0 ? (
          <View
            className="flex-row items-center gap-2 rounded-[16px] bg-successBg p-3"
            accessibilityLiveRegion="polite"
          >
            <CircleCheck size={22} color={colors.successFg} strokeWidth={2.2} />
            <Text font="bold" className="flex-1 text-base" style={{ color: colors.successFg }}>
              {t('extras.finished.sentOk', { count: sentCount })}
            </Text>
          </View>
        ) : null}

        {drafts.length ? (
          <View className="gap-2">
            <Text font="heading" className="text-lg" accessibilityRole="header">
              {t('extras.finished.ready')}
            </Text>
            {drafts.map((draft) => (
              <ItemLine
                key={draft.key}
                name={draft.name}
                qty={draft.qty}
                when={draft.when}
                removeLabel={t('extras.finished.removeDraft', { name: draft.name })}
                onRemove={() => setDrafts((current) => current.filter((d) => d.key !== draft.key))}
              />
            ))}
            <Button
              label={t('extras.finished.send', { count: drafts.length })}
              icon={Send}
              disabled={send.isPending}
              onPress={() => {
                setSentCount(0);
                send.mutate(drafts);
              }}
            />
          </View>
        ) : null}

        {mine.length ? (
          <View className="gap-2">
            <Text font="heading" className="text-lg" accessibilityRole="header">
              {t('extras.finished.alreadySent')}
            </Text>
            {mine.map((item) => (
              <ItemLine
                key={item.id}
                name={item.name}
                qty={item.qty}
                when={item.when}
                removeLabel={t('extras.finished.remove', { name: item.name })}
                onRemove={() => confirmRemove(item)}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>

      <ErrorDialog
        visible={Boolean(failed)}
        title={t(
          send.isError ? 'extras.finished.sendFailedTitle' : 'extras.finished.removeFailedTitle'
        )}
        message={t(errorMessageKey(failed?.error))}
        actionLabel={t('errors.retry')}
        onClose={() => failed?.reset()}
      />
    </SafeAreaView>
  );
}

/** Chef (buy list on): list what ran out and send it to the manager. */
export default function FinishedItemsScreen() {
  return (
    <FeatureGate feature="featureBuyList">
      <FinishedItems />
    </FeatureGate>
  );
}
