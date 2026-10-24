import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { LoadingView } from '@/components/ui/LoadingView';
import { NoConnection } from '@/components/ui/NoConnection';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { colors } from '@/theme/tokens';

import { categoryKinds, type CategoryKind, type CategoryRowData } from './categoryKinds';
import { useLocalName } from './useLocalName';

function CategoryRow({
  category,
  countKey,
  onEdit,
  onRemove,
}: {
  category: CategoryRowData;
  countKey: string;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const localName = useLocalName();

  return (
    <View className="flex-row items-center gap-2 rounded-[18px] border-[1.5px] border-border bg-surface py-2 pl-4 pr-2">
      <View className="min-w-0 flex-1">
        <Text font="bold" className="text-[17px] leading-tight" numberOfLines={1}>
          {localName(category)}
        </Text>
        <Text tone="muted" className="text-sm">
          {t(countKey, { count: category.count })}
        </Text>
      </View>
      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={t('categories.edit', { name: localName(category) })}
        className="h-11 w-11 items-center justify-center rounded-[12px] active:bg-background"
      >
        <Pencil size={22} color={colors.text} strokeWidth={2.2} />
      </Pressable>
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={t('categories.remove', { name: localName(category) })}
        className="h-11 w-11 items-center justify-center rounded-[12px] active:bg-dangerBg"
      >
        <Trash2 size={22} color={colors.dangerFg} strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

/** Owner and manager: menu categories (hot drinks, fast food…) or table categories (VIP, garden…). */
export default function CategoriesScreen({ kind = 'menu' }: { kind?: CategoryKind }) {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const localName = useLocalName();
  const config = categoryKinds[kind];

  const query = useQuery({ queryKey: config.queryKey, queryFn: config.list });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  const remove = useMutation({
    mutationFn: config.remove,
    onSettled: () => queryClient.invalidateQueries({ queryKey: config.refreshKey }),
  });

  const goBack = () => (router.canGoBack() ? router.back() : router.replace(config.backRoute));

  if (query.isPending) return <LoadingView screenTitle={t('categories.title')} onBack={goBack} />;
  if (query.isError && !query.data && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void refetch()} />;
  }

  const confirmRemove = (category: CategoryRowData) => {
    // A category with something in it must be emptied first: say so now, before asking.
    if (category.count > 0) {
      Alert.alert(t('categories.removeFailedTitle'), t('categories.errors.notEmpty'));
      return;
    }
    Alert.alert(
      t('categories.removeTitle', { name: localName(category) }),
      t('categories.removeBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('categories.removeAction'),
          style: 'destructive',
          onPress: () => remove.mutate(category.id),
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader
        title={t('categories.title')}
        subtitle={t(kind === 'menu' ? 'categories.subtitle' : 'categories.tableSubtitle')}
        onBack={goBack}
        right={
          <Pressable
            onPress={() => router.push(config.formPath)}
            accessibilityRole="button"
            accessibilityLabel={t('categories.addTitle')}
            className="h-11 flex-row items-center gap-1 rounded-[22px] bg-primary pl-3 pr-4 active:opacity-80"
          >
            <Plus size={20} color={colors.surface} strokeWidth={2.8} />
            <Text font="bold" tone="inverse" className="text-base">
              {t('categories.add')}
            </Text>
          </Pressable>
        }
      />

      {query.isError ? (
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text font="semibold" className="text-center text-lg">
            {t('categories.loadFailed')} {t(errorMessageKey(query.error))}
          </Text>
          <View className="w-full">
            <Button label={t('errors.retry')} icon={RefreshCw} onPress={() => void refetch()} />
          </View>
        </View>
      ) : (
        <FlatList
          data={query.data}
          keyExtractor={(category) => category.id}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <CategoryRow
              category={item}
              countKey={config.countKey}
              onEdit={() => router.push({ pathname: config.formPath, params: { id: item.id } })}
              onRemove={() => confirmRemove(item)}
            />
          )}
          ListEmptyComponent={
            <Text tone="muted" className="pt-8 text-center text-lg">
              {t('categories.empty')}
            </Text>
          }
        />
      )}

      <ErrorDialog
        visible={remove.isError}
        title={t('categories.removeFailedTitle')}
        message={t(errorMessageKey(remove.error))}
        actionLabel={t('errors.retry')}
        onClose={remove.reset}
      />
    </SafeAreaView>
  );
}
