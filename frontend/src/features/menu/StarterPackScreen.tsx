import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, CircleCheck, Info, Plus, RefreshCw } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { LoadingView } from '@/components/ui/LoadingView';
import { MoneyText } from '@/components/ui/MoneyText';
import { NoConnection } from '@/components/ui/NoConnection';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Switch } from '@/components/ui/Switch';
import { Text } from '@/components/ui/Text';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import {
  catalogItemsKey,
  catalogPacksKey,
  getCatalogItems,
  getCatalogPacks,
  importCatalog,
  type CatalogImportInput,
  type CatalogImportResult,
  type CatalogItem,
} from '@/lib/menu';
import { useBrandColors } from '@/store/theme';
import { colors } from '@/theme/tokens';

import { useLocalName } from './useLocalName';

function ItemRow({
  item,
  selected,
  onToggle,
}: {
  item: CatalogItem;
  selected: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const localName = useLocalName();
  const added = item.alreadyAdded;

  return (
    <Pressable
      onPress={onToggle}
      disabled={added}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: added || selected, disabled: added }}
      accessibilityLabel={t('menuAdmin.starter.select', { name: localName(item) })}
      className={`min-h-14 flex-row items-center gap-3 rounded-[14px] border-[1.5px] px-3 py-2 ${
        selected ? 'border-primary bg-primarySoft' : 'border-border bg-surface'
      } ${added ? 'opacity-70' : 'active:bg-background'}`}
    >
      <View
        className={`h-[26px] w-[26px] items-center justify-center rounded-md border-2 ${
          added || selected ? 'border-primary bg-primary' : 'border-borderStrong bg-surface'
        }`}
      >
        {added || selected ? <Check size={16} color={colors.surface} strokeWidth={3} /> : null}
      </View>
      <View className="min-w-0 flex-1">
        <Text font="bold" className="text-base leading-tight">
          {localName(item)}
        </Text>
        <MoneyText value={item.suggestedPriceEtb} font="bold" tone="link" className="text-[15px]" />
      </View>
      {added ? (
        <View className="rounded-[14px] bg-successBg px-2.5 py-[3px]">
          <Text font="bold" className="text-sm" style={{ color: colors.successFg }}>
            {t('menuAdmin.starter.alreadyAdded')}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** One starter menu: add the whole menu, a whole section, or chosen items. */
export default function StarterPackScreen() {
  const brand = useBrandColors();
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const localName = useLocalName();
  const { key = '' } = useLocalSearchParams<{ key: string }>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addOff, setAddOff] = useState(false);
  const [result, setResult] = useState<CatalogImportResult | null>(null);

  const packs = useQuery({ queryKey: catalogPacksKey, queryFn: getCatalogPacks });
  const items = useQuery({
    queryKey: catalogItemsKey(key),
    queryFn: () => getCatalogItems({ pack: key }),
  });

  const mutation = useMutation({
    mutationFn: (input: CatalogImportInput) => importCatalog({ ...input, activate: !addOff }),
    onSuccess: (res) => {
      setResult(res);
      setSelected(new Set());
      // Refreshes the menu, the pack counts and the "Added" tags.
      void queryClient.invalidateQueries({ queryKey: ['menu'] });
    },
  });

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/menu/packs'));
  const refetchAll = () => {
    void packs.refetch();
    void items.refetch();
  };

  if (packs.isPending || items.isPending || mutation.isPending)
    return <LoadingView screenTitle={t('menuAdmin.starter.title')} onBack={goBack} />;
  const loadError = packs.error ?? items.error;
  if (loadError && isNetworkError(loadError)) return <NoConnection onRetry={refetchAll} />;

  const pack = packs.data?.find((p) => p.key === key);
  const all = items.data ?? [];
  const notAdded = all.filter((i) => !i.alreadyAdded);

  const toggle = (itemKey: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(itemKey)) next.delete(itemKey);
      else next.add(itemKey);
      return next;
    });

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader
        title={pack ? localName(pack) : t('menuAdmin.starter.title')}
        subtitle={
          pack
            ? t('menuAdmin.starter.added', { added: pack.addedCount, total: pack.itemCount })
            : undefined
        }
        onBack={goBack}
      />

      {loadError || !pack ? (
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text font="semibold" className="text-center text-lg">
            {t(errorMessageKey(loadError))}
          </Text>
          <View className="w-full">
            <Button label={t('errors.retry')} icon={RefreshCw} onPress={refetchAll} />
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}>
          {result ? (
            <View
              className="flex-row items-start gap-2 rounded-[16px] bg-successBg p-3"
              accessibilityLiveRegion="polite"
            >
              <CircleCheck size={22} color={colors.successFg} strokeWidth={2.2} />
              <View className="flex-1">
                <Text font="bold" className="text-base" style={{ color: colors.successFg }}>
                  {t('menuAdmin.starter.resultAdded', { count: result.totalCreated })}
                </Text>
                {result.skipped.length ? (
                  <Text font="semibold" className="text-sm" style={{ color: colors.successFg }}>
                    {t('menuAdmin.starter.resultSkipped', { count: result.skipped.length })}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          <View className="flex-row items-start gap-2">
            <Info size={18} color={brand.primaryText} strokeWidth={2.2} />
            <Text tone="muted" className="flex-1 text-sm leading-5">
              {t('menuAdmin.starter.priceNote')}
            </Text>
          </View>

          <View className="flex-row items-center gap-3 rounded-[18px] border-[1.5px] border-border bg-surface px-4 py-3">
            <View className="flex-1">
              <Text font="bold" className="text-base">
                {t('menuAdmin.starter.addOff')}
              </Text>
              <Text tone="muted" className="text-sm">
                {t('menuAdmin.starter.addOffHint')}
              </Text>
            </View>
            <Switch
              value={addOff}
              onValueChange={setAddOff}
              accessibilityLabel={t('menuAdmin.starter.addOff')}
            />
          </View>

          {notAdded.length ? (
            <Button
              label={t('menuAdmin.starter.addPack', { count: notAdded.length })}
              icon={Plus}
              onPress={() => mutation.mutate({ packs: [pack.key] })}
            />
          ) : null}

          {pack.groups.map((group) => {
            const groupItems = all.filter((i) => i.groupKey === group.key);
            const remaining = groupItems.filter((i) => !i.alreadyAdded).length;
            return (
              <View key={group.key} className="gap-2 pt-2">
                <View className="min-h-11 flex-row items-center gap-2">
                  <Text font="heading" className="flex-1 text-lg" accessibilityRole="header">
                    {localName(group)}
                  </Text>
                  {remaining ? (
                    <Pressable
                      onPress={() =>
                        mutation.mutate({ groups: [{ pack: pack.key, group: group.key }] })
                      }
                      accessibilityRole="button"
                      className="h-11 flex-row items-center gap-1 rounded-[22px] border-2 border-primary bg-surface pl-3 pr-4 active:bg-background"
                    >
                      <Plus size={18} color={brand.primary} strokeWidth={2.8} />
                      <Text font="bold" className="text-[15px]" style={{ color: brand.primary }}>
                        {t('menuAdmin.starter.addSection', { count: remaining })}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text font="bold" className="text-sm" style={{ color: colors.successFg }}>
                      {t('menuAdmin.starter.sectionDone')}
                    </Text>
                  )}
                </View>
                {groupItems.map((item) => (
                  <ItemRow
                    key={item.key}
                    item={item}
                    selected={selected.has(item.key)}
                    onToggle={() => toggle(item.key)}
                  />
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}

      {selected.size ? (
        <View className="border-t border-border bg-surface px-4 pb-6 pt-3">
          <Button
            label={t('menuAdmin.starter.addSelected', { count: selected.size })}
            icon={Plus}
            onPress={() =>
              mutation.mutate({ items: [...selected].map((itemKey) => ({ key: itemKey })) })
            }
          />
        </View>
      ) : null}

      <ErrorDialog
        visible={mutation.isError}
        title={t('menuAdmin.starter.importFailedTitle')}
        message={t(errorMessageKey(mutation.error))}
        actionLabel={t('errors.retry')}
        onClose={mutation.reset}
      />
    </SafeAreaView>
  );
}
