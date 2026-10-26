import { useMutation } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { Info, NotebookPen, Wallet, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Switch } from '@/components/ui/Switch';
import { Text } from '@/components/ui/Text';
import { errorMessageKey } from '@/lib/errors';
import { updateFeatures, type Features } from '@/lib/extras';
import { homeRouteFor, useSession } from '@/store/session';
import { useFeatures } from '@/store/features';
import { useBrandColors } from '@/store/theme';

function FeatureRow({
  icon: Icon,
  title,
  hint,
  value,
  disabled,
  onChange,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
  value: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  const brand = useBrandColors();
  return (
    <View className="flex-row items-center gap-3 rounded-[18px] border-[1.5px] border-border bg-surface px-3 py-3">
      <View className="h-11 w-11 items-center justify-center rounded-[12px] bg-primaryTile">
        <Icon size={22} color={brand.primary} strokeWidth={2.2} />
      </View>
      <View className="min-w-0 flex-1">
        <Text font="bold" className="text-base">
          {title}
        </Text>
        <Text tone="muted" className="text-sm leading-5">
          {hint}
        </Text>
      </View>
      <View className={disabled ? 'opacity-50' : ''} pointerEvents={disabled ? 'none' : 'auto'}>
        <Switch value={value} onValueChange={onChange} accessibilityLabel={title} />
      </View>
    </View>
  );
}

/** Owner: switch the extras on or off. Off only hides a feature; nothing is deleted. */
export default function ExtraFeaturesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const brand = useBrandColors();
  const user = useSession((s) => s.user);
  const features = useFeatures();

  const change = useMutation({
    mutationFn: (changes: Partial<Features>) => updateFeatures(changes),
    onSuccess: (updated) => useFeatures.getState().set(updated),
  });

  if (!user || user.role !== 'owner') return <Redirect href={homeRouteFor(user)} />;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/profile'));

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader title={t('extras.title')} subtitle={t('extras.subtitle')} onBack={goBack} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 10 }}>
        <FeatureRow
          icon={NotebookPen}
          title={t('extras.buyList')}
          hint={t('extras.buyListHint')}
          value={features.featureBuyList}
          disabled={change.isPending}
          onChange={(value) => change.mutate({ featureBuyList: value })}
        />
        <FeatureRow
          icon={Wallet}
          title={t('extras.moneyOut')}
          hint={t('extras.moneyOutHint')}
          value={features.featureMoneyOut}
          disabled={change.isPending}
          onChange={(value) => change.mutate({ featureMoneyOut: value })}
        />
        <View className="flex-row items-start gap-2 px-1 pt-1">
          <Info size={18} color={brand.primaryText} strokeWidth={2.2} />
          <Text tone="muted" className="flex-1 text-sm leading-5">
            {t('extras.hiddenNote')}
          </Text>
        </View>
      </ScrollView>

      <ErrorDialog
        visible={change.isError}
        title={t('extras.saveFailedTitle')}
        message={t(errorMessageKey(change.error))}
        actionLabel={t('errors.retry')}
        onClose={change.reset}
      />
    </SafeAreaView>
  );
}
