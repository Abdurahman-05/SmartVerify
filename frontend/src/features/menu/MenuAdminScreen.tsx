import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { Plus, RefreshCw } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
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
import { getMenuItems, menuAdminKey, updateMenuItem, type MenuAdminItem } from '@/lib/menu';
import type { MenuCategory } from '@/lib/mock/restaurant';
import { useBrandColors } from '@/store/theme';
import { colors } from '@/theme/tokens';

const categories: ('all' | MenuCategory)[] = ['all', 'food', 'drinks', 'combos'];

function MenuRow({
  item,
  onEdit,
  onToggle,
}: {
  item: MenuAdminItem;
  onEdit: () => void;
  onToggle: (active: boolean) => void;
}) {
  const brand = useBrandColors();
  const { t } = useTranslation();
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
            {item.name}
          </Text>
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

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/profile'));

  if (query.isPending) return <LoadingView />;
  if (query.isError && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void refetch()} />;
  }

  const items = query.data ?? [];
  const shown = category === 'all' ? items : items.filter((item) => item.category === category);

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
        visible={toggle.isError}
        title={t('menuAdmin.toggleFailedTitle')}
        message={t(errorMessageKey(toggle.error))}
        actionLabel={t('errors.retry')}
        onClose={toggle.reset}
      />
    </SafeAreaView>
  );
}
