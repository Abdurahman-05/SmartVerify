import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ChevronRight,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react-native';
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
import { Text } from '@/components/ui/Text';
import { categoryIcon } from '@/features/orders/MenuItemRow';
import { Pill } from '@/features/orders/Pill';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { getMenuItems, menuAdminKey, removeMenuItem, type MenuAdminItem } from '@/lib/menu';
import { getMenuCategories, itemCategoryKey, menuCategoriesKey } from '@/lib/menuCategories';
import { useBrandColors } from '@/store/theme';
import { colors } from '@/theme/tokens';

import { useLocalName } from './useLocalName';

function MenuRow({
  item,
  onEdit,
  onRemove,
}: {
  item: MenuAdminItem;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const brand = useBrandColors();
  const { t, i18n } = useTranslation();
  const localName = useLocalName();
  const Icon = categoryIcon[item.category];
  const categoryName =
    i18n.language === 'am' && item.categoryNameAm ? item.categoryNameAm : item.categoryName;
  const subtitle = [categoryName, item.groupName].filter(Boolean).join(' · ');

  return (
    <View className="flex-row items-center gap-1 rounded-[18px] border-[1.5px] border-border bg-surface py-2 pl-2 pr-2">
      <View className="min-h-14 min-w-0 flex-1 flex-row items-center gap-3">
        <View className="h-14 w-14 items-center justify-center rounded-[14px] bg-primaryTile">
          <Icon size={26} color={brand.primary} strokeWidth={2} />
        </View>
        <View className="min-w-0 flex-1">
          <Text font="bold" className="text-[17px] leading-tight">
            {localName(item)}
          </Text>
          {subtitle ? (
            <Text tone="muted" className="text-sm" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          <MoneyText value={item.priceEtb} font="bold" tone="link" className="mt-[3px] text-base" />
        </View>
      </View>
      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={t('menuAdmin.editItem', { name: localName(item) })}
        className="h-11 w-11 items-center justify-center rounded-[12px] active:bg-background"
      >
        <Pencil size={22} color={colors.text} strokeWidth={2.2} />
      </Pressable>
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={t('menuAdmin.remove', { name: localName(item) })}
        className="h-11 w-11 items-center justify-center rounded-[12px] active:bg-dangerBg"
      >
        <Trash2 size={22} color={colors.dangerFg} strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

function LinkCard({
  icon: Icon,
  title,
  hint,
  onPress,
}: {
  icon: typeof Sparkles;
  title: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="mx-4 mb-2.5 flex-row items-center gap-3 rounded-[18px] border-2 border-primary bg-primarySoft px-3 py-2.5 active:opacity-80"
    >
      <View className="h-11 w-11 items-center justify-center rounded-[12px] bg-primary">
        <Icon size={22} color={colors.surface} strokeWidth={2.2} />
      </View>
      <View className="min-w-0 flex-1">
        <Text font="bold" className="text-base">
          {title}
        </Text>
        <Text tone="muted" className="text-sm">
          {hint}
        </Text>
      </View>
      <ChevronRight size={22} color={colors.muted} strokeWidth={2.2} />
    </Pressable>
  );
}

export default function MenuAdminScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const localName = useLocalName();
  // 'all', or a category id.
  const [category, setCategory] = useState('all');

  const query = useQuery({ queryKey: menuAdminKey, queryFn: getMenuItems });
  const categoriesQuery = useQuery({ queryKey: menuCategoriesKey, queryFn: getMenuCategories });
  const { refetch } = query;
  // Lists refetch when the screen comes back into view (e.g. after adding an item).
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  const remove = useMutation({
    mutationFn: removeMenuItem,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['menu'] }),
  });

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/profile'));

  if (query.isPending) return <LoadingView screenTitle={t('menuAdmin.title')} onBack={goBack} />;
  if (query.isError && !query.data && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void refetch()} />;
  }

  const items = query.data ?? [];
  const categories = categoriesQuery.data ?? [];
  // A category that was deleted while selected falls back to "all".
  const chosen = categories.some((c) => c.id === category) ? category : 'all';
  const shown = chosen === 'all' ? items : items.filter((item) => itemCategoryKey(item) === chosen);

  const confirmRemove = (item: MenuAdminItem) =>
    Alert.alert(t('menuAdmin.removeTitle', { name: item.name }), t('menuAdmin.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('menuAdmin.removeAction'),
        style: 'destructive',
        onPress: () => remove.mutate(item.id),
      },
    ]);

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
          <Pill
            label={t('orders.category.all')}
            selected={chosen === 'all'}
            onPress={() => setCategory('all')}
          />
          {categories.map((c) => (
            <Pill
              key={c.id}
              label={localName(c)}
              selected={chosen === c.id}
              onPress={() => setCategory(c.id)}
            />
          ))}
        </ScrollView>
      </View>

      <LinkCard
        icon={Layers}
        title={t('categories.manage')}
        hint={t('categories.manageHint')}
        onPress={() => router.push('/menu/categories')}
      />
      <LinkCard
        icon={Sparkles}
        title={t('menuAdmin.starter.open')}
        hint={t('menuAdmin.starter.openHint')}
        onPress={() => router.push('/menu/packs')}
      />

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
        visible={remove.isError}
        title={t('menuAdmin.removeFailedTitle')}
        message={t(errorMessageKey(remove.error))}
        actionLabel={t('errors.retry')}
        onClose={remove.reset}
      />
    </SafeAreaView>
  );
}
