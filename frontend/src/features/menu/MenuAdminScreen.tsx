import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, Eye, EyeOff, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { LoadingView } from '@/components/ui/LoadingView';
import { MoneyText } from '@/components/ui/MoneyText';
import { NoConnection } from '@/components/ui/NoConnection';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Switch } from '@/components/ui/Switch';
import { Text } from '@/components/ui/Text';
import { categoryIcon } from '@/features/orders/MenuItemRow';
import { Pill } from '@/features/orders/Pill';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import {
  getMenuItems,
  menuAdminKey,
  removeMenuItem,
  setMenuItemsActive,
  updateMenuItem,
  type MenuAdminItem,
} from '@/lib/menu';
import type { MenuCategory } from '@/lib/mock/restaurant';
import { useBrandColors } from '@/store/theme';
import { colors } from '@/theme/tokens';

import { useLocalName } from './useLocalName';

const categories: ('all' | MenuCategory)[] = ['all', 'food', 'drinks', 'combos'];

function MenuRow({
  item,
  onEdit,
  onToggle,
  onRemove,
}: {
  item: MenuAdminItem;
  onEdit: () => void;
  onToggle: (active: boolean) => void;
  onRemove: () => void;
}) {
  const brand = useBrandColors();
  const { t } = useTranslation();
  const localName = useLocalName();
  const Icon = categoryIcon[item.category];

  return (
    <View
      className={`flex-row items-center gap-3 rounded-[18px] border-[1.5px] border-border bg-surface py-2 pl-2 pr-3 ${
        item.active ? '' : 'opacity-80'
      }`}
    >
      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={t('menuAdmin.editItem', { name: item.name })}
        className="min-h-14 flex-1 flex-row items-center gap-3 rounded-[14px] active:opacity-70"
      >
        <View className="h-14 w-14 items-center justify-center rounded-[14px] bg-primaryTile">
          <Icon size={26} color={brand.primary} strokeWidth={2} />
        </View>
        <View className="min-w-0 flex-1">
          <Text font="bold" className="text-[17px] leading-tight">
            {localName(item)}
          </Text>
          {item.groupName ? (
            <Text tone="muted" className="text-sm">
              {item.groupName}
            </Text>
          ) : null}
          {item.active ? (
            <MoneyText
              value={item.priceEtb}
              font="bold"
              tone="link"
              className="mt-[3px] text-base"
            />
          ) : (
            <Text font="bold" className="mt-[3px] text-[15px]" style={{ color: colors.dangerFg }}>
              {t('menuAdmin.finished')}
            </Text>
          )}
        </View>
      </Pressable>
      <View className="items-center gap-0.5">
        <Switch
          value={item.active}
          onValueChange={onToggle}
          accessibilityLabel={t('menuAdmin.available', { name: item.name })}
        />
        <Text font="bold" tone="muted" className="text-sm">
          {item.active ? t('menuAdmin.on') : t('menuAdmin.off')}
        </Text>
      </View>
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={t('menuAdmin.remove', { name: localName(item) })}
        hitSlop={4}
        className="h-11 w-11 items-center justify-center rounded-[12px] active:bg-dangerBg"
      >
        <Trash2 size={22} color={colors.dangerFg} strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

export default function MenuAdminScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<'all' | MenuCategory>('all');

  const query = useQuery({ queryKey: menuAdminKey, queryFn: getMenuItems });
  const { refetch } = query;
  // Lists refetch when the screen comes back into view (e.g. after adding an item).
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  // Optimistic on/off: the switch moves at once and rolls back if the server refuses.
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => updateMenuItem(id, { active }),
    onMutate: async ({ id, active }) => {
      await queryClient.cancelQueries({ queryKey: menuAdminKey });
      const previous = queryClient.getQueryData<MenuAdminItem[]>(menuAdminKey);
      queryClient.setQueryData<MenuAdminItem[]>(menuAdminKey, (items) =>
        items?.map((item) => (item.id === id ? { ...item, active } : item))
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      queryClient.setQueryData(menuAdminKey, context?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['menu'] }),
  });

  const refreshMenu = () => queryClient.invalidateQueries({ queryKey: ['menu'] });
  const remove = useMutation({ mutationFn: removeMenuItem, onSettled: refreshMenu });
  const bulk = useMutation({
    mutationFn: ({ ids, active }: { ids: string[]; active: boolean }) =>
      setMenuItemsActive(ids, active),
    onSettled: refreshMenu,
  });

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/profile'));

  if (query.isPending) return <LoadingView screenTitle={t('menuAdmin.title')} onBack={goBack} />;
  if (query.isError && !query.data && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void refetch()} />;
  }

  const items = query.data ?? [];
  const shown = category === 'all' ? items : items.filter((item) => item.category === category);
  const offIds = shown.filter((item) => !item.active).map((item) => item.id);
  const onIds = shown.filter((item) => item.active).map((item) => item.id);

  const confirmRemove = (item: MenuAdminItem) =>
    Alert.alert(t('menuAdmin.removeTitle', { name: item.name }), t('menuAdmin.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('menuAdmin.removeAction'),
        style: 'destructive',
        onPress: () => remove.mutate(item.id),
      },
    ]);
  const confirmAllOff = () =>
    Alert.alert(t('menuAdmin.allOffTitle', { count: onIds.length }), t('menuAdmin.allOffBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('menuAdmin.allOff'),
        style: 'destructive',
        onPress: () => bulk.mutate({ ids: onIds, active: false }),
      },
    ]);
  const failed = toggle.isError ? toggle : remove.isError ? remove : bulk.isError ? bulk : null;
  const failedTitle = toggle.isError
    ? 'menuAdmin.toggleFailedTitle'
    : remove.isError
      ? 'menuAdmin.removeFailedTitle'
      : 'menuAdmin.bulkFailedTitle';

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader
        title={t('menuAdmin.title')}
        subtitle={t('menuAdmin.subtitle')}
        onBack={goBack}
        right={
          <Pressable
            onPress={() => router.push('/menu/edit')}
            accessibilityRole="button"
            accessibilityLabel={t('menuAdmin.addTitle')}
            className="h-11 flex-row items-center gap-1 rounded-[22px] bg-primary pl-3 pr-4 active:opacity-80"
          >
            <Plus size={20} color={colors.surface} strokeWidth={2.8} />
            <Text font="bold" tone="inverse" className="text-base">
              {t('menuAdmin.add')}
            </Text>
          </Pressable>
        }
      />

      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 10 }}
          accessibilityRole="radiogroup"
        >
          {categories.map((c) => (
            <Pill
              key={c}
              label={t(`orders.category.${c}`)}
              selected={category === c}
              onPress={() => setCategory(c)}
            />
          ))}
        </ScrollView>
      </View>

      <Pressable
        onPress={() => router.push('/menu/packs')}
        accessibilityRole="button"
        className="mx-4 mb-2.5 flex-row items-center gap-3 rounded-[18px] border-2 border-primary bg-primarySoft px-3 py-2.5 active:opacity-80"
      >
        <View className="h-11 w-11 items-center justify-center rounded-[12px] bg-primary">
          <Sparkles size={22} color={colors.surface} strokeWidth={2.2} />
        </View>
        <View className="min-w-0 flex-1">
          <Text font="bold" className="text-base">
            {t('menuAdmin.starter.open')}
          </Text>
          <Text tone="muted" className="text-sm">
            {t('menuAdmin.starter.openHint')}
          </Text>
        </View>
        <ChevronRight size={22} color={colors.muted} strokeWidth={2.2} />
      </Pressable>

      {shown.length ? (
        <View className="flex-row gap-2 px-4 pb-2.5">
          <View className="flex-1">
            <Button
              label={t('menuAdmin.allOn')}
              icon={Eye}
              variant="outline"
              size="md"
              disabled={offIds.length === 0 || bulk.isPending}
              onPress={() => bulk.mutate({ ids: offIds, active: true })}
            />
          </View>
          <View className="flex-1">
            <Button
              label={t('menuAdmin.allOff')}
              icon={EyeOff}
              variant="outline"
              size="md"
              disabled={onIds.length === 0 || bulk.isPending}
              onPress={confirmAllOff}
            />
          </View>
        </View>
      ) : null}

      {query.isError ? (
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text font="semibold" className="text-center text-lg">
            {t('menuAdmin.loadFailed')} {t(errorMessageKey(query.error))}
          </Text>
          <View className="w-full">
            <Button label={t('errors.retry')} icon={RefreshCw} onPress={() => void refetch()} />
          </View>
        </View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <MenuRow
              item={item}
              onEdit={() => router.push({ pathname: '/menu/edit', params: { id: item.id } })}
              onToggle={(active) => toggle.mutate({ id: item.id, active })}
              onRemove={() => confirmRemove(item)}
            />
          )}
          ListEmptyComponent={
            <Text tone="muted" className="pt-8 text-center text-lg">
              {t('menuAdmin.empty')}
            </Text>
          }
        />
      )}

      <ErrorDialog
        visible={Boolean(failed)}
        title={t(failedTitle)}
        message={t(errorMessageKey(failed?.error))}
        actionLabel={t('errors.retry')}
        onClose={() => failed?.reset()}
      />
    </SafeAreaView>
  );
}
