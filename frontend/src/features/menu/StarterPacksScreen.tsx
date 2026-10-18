import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, RefreshCw, UtensilsCrossed } from 'lucide-react-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { LoadingView } from '@/components/ui/LoadingView';
import { NoConnection } from '@/components/ui/NoConnection';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { catalogPacksKey, getCatalogPacks } from '@/lib/menu';
import { useBrandColors } from '@/store/theme';
import { colors } from '@/theme/tokens';

import { useLocalName } from './useLocalName';

/** Starter menus: pick a kind of restaurant, then add its items. */
export default function StarterPacksScreen() {
  const brand = useBrandColors();
  const { t } = useTranslation();
  const router = useRouter();
  const localName = useLocalName();

  const query = useQuery({ queryKey: catalogPacksKey, queryFn: getCatalogPacks });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/menu'));

  if (query.isPending)
    return <LoadingView screenTitle={t('menuAdmin.starter.title')} onBack={goBack} />;
  if (query.isError && !query.data && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void refetch()} />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader
        title={t('menuAdmin.starter.title')}
        subtitle={t('menuAdmin.starter.subtitle')}
        onBack={goBack}
      />

      {query.isError ? (
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text font="semibold" className="text-center text-lg">
            {t(errorMessageKey(query.error))}
          </Text>
          <View className="w-full">
            <Button label={t('errors.retry')} icon={RefreshCw} onPress={() => void refetch()} />
          </View>
        </View>
      ) : (
        <FlatList
          data={query.data}
          keyExtractor={(pack) => pack.key}
          contentContainerStyle={{
            gap: 10,
            paddingHorizontal: 16,
            paddingTop: 4,
            paddingBottom: 24,
          }}
          renderItem={({ item: pack }) => {
            const done = pack.itemCount > 0 && pack.addedCount >= pack.itemCount;
            const percent = pack.itemCount ? (pack.addedCount / pack.itemCount) * 100 : 0;
            return (
              <Pressable
                onPress={() =>
                  router.push({ pathname: '/menu/packs/[key]', params: { key: pack.key } })
                }
                accessibilityRole="button"
                accessibilityLabel={`${localName(pack)}, ${t('menuAdmin.starter.added', {
                  added: pack.addedCount,
                  total: pack.itemCount,
                })}`}
                className="flex-row items-center gap-3 rounded-[18px] border-[1.5px] border-border bg-surface p-3 active:bg-background"
              >
                <View className="h-14 w-14 items-center justify-center rounded-[14px] bg-primaryTile">
                  <UtensilsCrossed size={26} color={brand.primary} strokeWidth={2} />
                </View>
                <View className="min-w-0 flex-1 gap-1">
                  <Text font="bold" className="text-[17px] leading-tight">
                    {localName(pack)}
                  </Text>
                  <Text
                    font="semibold"
                    className="text-sm"
                    style={{ color: done ? colors.successFg : colors.muted }}
                  >
                    {t('menuAdmin.starter.added', {
                      added: pack.addedCount,
                      total: pack.itemCount,
                    })}
                  </Text>
                  <View className="h-1.5 overflow-hidden rounded-full bg-neutralBg">
                    <View
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${percent}%` }}
                    />
                  </View>
                </View>
                <ChevronRight size={22} color={colors.muted} strokeWidth={2.2} />
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
