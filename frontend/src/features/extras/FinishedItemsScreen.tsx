import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { CircleCheck, ListChecks, Plus, Send, Trash2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Keyboard, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { GlassCard } from '@/components/ui/GlassCard';
import { useGlass } from '@/components/ui/glassTokens';
import { Input } from '@/components/ui/Input';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { toastIfNetworkError } from '@/store/toast';
import {
  addBuyItem,
  buyItemsKey,
  getBuyItems,
  removeBuyItem,
  type BuyItem,
  type NewBuyItem,
} from '@/lib/extras';
import { useSession } from '@/store/session';
import { colors } from '@/theme/tokens';

import { FeatureGate } from './FeatureGate';
import { ScreenBg } from '@/ui/glass';

type Draft = NewBuyItem & { key: number };

/**
 * "Send to manager" floats 12 above the bottom of the screen. The tab layout already pads every
 * tab scene by the nav's room (see NAV_ROOM), so that bottom edge is above the nav.
 */
const SEND_HEIGHT = 56;
const SEND_BOTTOM = 12;

/** The buy list no longer asks for a date: everything is needed today. */
const WHEN = 'TODAY' as const;

/** A line of the list: icon tile, name, amount and a delete button. */
function ItemLine({
  name,
  qty,
  removeLabel,
  onRemove,
  first,
}: {
  name: string;
  qty: string | null | undefined;
  removeLabel: string;
  onRemove: () => void;
  first?: boolean;
}) {
  const g = useGlass();
  return (
    <View
      className={`flex-row items-center gap-3 py-3 ${first ? '' : 'border-t border-black/[0.07]'}`}
    >
      <View
        className="h-12 w-12 items-center justify-center rounded-[14px]"
        style={{ backgroundColor: g.primaryDeep }}
      >
        <ListChecks size={24} color="#FFFFFF" strokeWidth={2.2} />
      </View>
      <View className="min-w-0 flex-1">
        <Text font="bold" className="text-base" numberOfLines={1}>
          {name}
        </Text>
        {qty ? (
          <Text tone="muted" className="text-sm" numberOfLines={1}>
            {qty}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={removeLabel}
        className="h-11 w-11 items-center justify-center rounded-full active:bg-dangerBg"
      >
        <Trash2 size={22} color={colors.muted} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

function FinishedItems() {
  const g = useGlass();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const myName = useSession((s) => s.user?.displayName);

  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
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
      for (const { key, name: itemName, qty: itemQty } of items) {
        await addBuyItem({ name: itemName, qty: itemQty, when: WHEN });
        setDrafts((current) => current.filter((d) => d.key !== key));
      }
      return items.length;
    },
    onSuccess: (count) => setSentCount(count),
    onError: toastIfNetworkError,
    onSettled: () => queryClient.invalidateQueries({ queryKey: buyItemsKey }),
  });
  const remove = useMutation({
    mutationFn: removeBuyItem,
    onError: toastIfNetworkError,
    onSettled: () => queryClient.invalidateQueries({ queryKey: buyItemsKey }),
  });

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
      {
        key: Date.now() + current.length,
        name: name.trim(),
        qty: qty.trim() || undefined,
        when: WHEN,
      },
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
    <ScreenBg>
      <SafeAreaView edges={['top']} className="flex-1">
        <ScreenHeader title={t('extras.finished.title')} subtitle={t('extras.finished.subtitle')} />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: 16,
            // Room for the Send button only while it is shown, so the last item is never hidden.
            paddingBottom: drafts.length ? SEND_HEIGHT + SEND_BOTTOM + 24 : 16,
            gap: 12,
          }}
        >
          <GlassCard style={{ gap: 12, paddingHorizontal: 16, paddingVertical: 14 }}>
            <Input
              round
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
              round
              label={t('extras.finished.amount')}
              placeholder={t('extras.finished.amountPlaceholder')}
              value={qty}
              onChangeText={setQty}
              maxLength={40}
            />
            <PrimaryButton label={t('extras.finished.add')} icon={Plus} height={54} onPress={add} />
          </GlassCard>

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
            <>
              <Text font="heading" className="px-1 text-lg" accessibilityRole="header">
                {t('extras.finished.yourList')} · {drafts.length}
              </Text>
              <GlassCard style={{ paddingHorizontal: 16, paddingVertical: 2 }}>
                {drafts.map((draft, i) => (
                  <ItemLine
                    first={i === 0}
                    key={draft.key}
                    name={draft.name}
                    qty={draft.qty}
                    removeLabel={t('extras.finished.removeDraft', { name: draft.name })}
                    onRemove={() =>
                      setDrafts((current) => current.filter((d) => d.key !== draft.key))
                    }
                  />
                ))}
              </GlassCard>
            </>
          ) : null}

          {open.isPending ? (
            <ActivityIndicator color={g.primaryDeep} accessibilityLabel={t('loading.label')} />
          ) : null}

          {open.isError && !open.data ? (
            <GlassCard style={{ gap: 12, paddingHorizontal: 16, paddingVertical: 14 }}>
              <Text tone="muted" className="text-base">
                {t(errorMessageKey(open.error))}
              </Text>
              <PrimaryButton label={t('errors.retry')} onPress={() => void refetch()} />
            </GlassCard>
          ) : null}

          {mine.length ? (
            <>
              <Text font="heading" className="px-1 text-lg" accessibilityRole="header">
                {t('extras.finished.alreadySent')} · {mine.length}
              </Text>
              <GlassCard style={{ paddingHorizontal: 16, paddingVertical: 2 }}>
                {mine.map((item, i) => (
                  <ItemLine
                    first={i === 0}
                    key={item.id}
                    name={item.name}
                    qty={item.qty}
                    removeLabel={t('extras.finished.remove', { name: item.name })}
                    onRemove={() => confirmRemove(item)}
                  />
                ))}
              </GlassCard>
            </>
          ) : null}
        </ScrollView>

        {drafts.length ? (
          <View
            pointerEvents="box-none"
            style={{ position: 'absolute', left: 16, right: 16, bottom: SEND_BOTTOM }}
          >
            <PrimaryButton
              label={t('extras.finished.send')}
              icon={Send}
              height={SEND_HEIGHT}
              disabled={send.isPending}
              onPress={() => {
                setSentCount(0);
                send.mutate(drafts);
              }}
            />
          </View>
        ) : null}

        <ErrorDialog
          visible={Boolean(failed) && !isNetworkError(failed?.error)}
          title={t(
            send.isError ? 'extras.finished.sendFailedTitle' : 'extras.finished.removeFailedTitle'
          )}
          message={t(errorMessageKey(failed?.error))}
          actionLabel={t('errors.retry')}
          onClose={() => failed?.reset()}
        />
      </SafeAreaView>
    </ScreenBg>
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
