import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { FormScreen } from '@/components/ui/FormScreen';
import { Input } from '@/components/ui/Input';
import { LoadingView } from '@/components/ui/LoadingView';
import { NoConnection } from '@/components/ui/NoConnection';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { ApiError } from '@/lib/api/client';
import { getBusinessProfile, updateBusinessProfile } from '@/lib/business';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { useSession } from '@/store/session';
import { colors } from '@/theme/tokens';

/** Owner: business type, city, address and map location (only the Smart Verify team sees it). */
export default function BusinessInfoScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isOwner = useSession((s) => s.user?.role === 'owner');
  const profile = useQuery({ queryKey: ['business-profile'], queryFn: getBusinessProfile });
  // Edits; until the owner types, each field shows what is saved.
  const [typeEdit, setType] = useState<string | null>(null);
  const [cityEdit, setCity] = useState<string | null>(null);
  const [addressEdit, setAddress] = useState<string | null>(null);
  const [locationEdit, setLocation] = useState<string | null>(null);
  const p = profile.data;
  const type = typeEdit ?? p?.businessType ?? '';
  const city = cityEdit ?? p?.city ?? '';
  const address = addressEdit ?? p?.address ?? '';
  const location =
    locationEdit ??
    (p && p.latitude !== null && p.longitude !== null ? `${p.latitude}, ${p.longitude}` : '');

  const save = useMutation({
    mutationFn: () =>
      updateBusinessProfile({
        businessType: type.trim() || null,
        city: city.trim() || null,
        address: address.trim() || null,
        location: location.trim(),
      }),
    onSuccess: (saved) => queryClient.setQueryData(['business-profile'], saved),
  });

  if (!isOwner) return <Redirect href="/profile" />;
  if (profile.isPending) return <LoadingView screenTitle={t('business.businessInfo.title')} />;
  if (profile.isError && isNetworkError(profile.error)) {
    return <NoConnection onRetry={() => void profile.refetch()} />;
  }

  const locationError =
    save.error instanceof ApiError && save.error.code === 'VALIDATION_ERROR'
      ? t('business.businessInfo.invalidLocation')
      : undefined;
  const hasLocation = profile.data?.latitude !== null && profile.data?.latitude !== undefined;

  return (
    <FormScreen>
      <ScreenHeader
        title={t('business.businessInfo.title')}
        subtitle={profile.data?.name}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
      />
      <View className="gap-4 px-4 pt-2">
        <Text tone="muted" className="text-[15px]">
          {t('business.businessInfo.subtitle')}
        </Text>
        <Input
          label={t('business.businessInfo.type')}
          value={type}
          onChangeText={setType}
          placeholder={t('business.businessInfo.typePlaceholder')}
          maxLength={60}
        />
        <Input
          label={t('business.businessInfo.city')}
          value={city}
          onChangeText={setCity}
          maxLength={60}
        />
        <Input
          label={t('business.businessInfo.address')}
          value={address}
          onChangeText={setAddress}
          placeholder={t('business.businessInfo.addressPlaceholder')}
          maxLength={200}
        />
        <Input
          label={t('business.businessInfo.location')}
          value={location}
          onChangeText={(v) => {
            save.reset();
            setLocation(v);
          }}
          placeholder={t('business.businessInfo.locationPlaceholder')}
          autoCapitalize="none"
          autoCorrect={false}
          error={locationError}
        />
        <Text tone="muted" className="text-sm">
          {t('business.businessInfo.locationHint')}
        </Text>
        {hasLocation ? (
          <View className="flex-row items-center gap-2">
            <MapPin size={18} color={colors.success} strokeWidth={2.2} />
            <Text font="semibold" className="text-sm text-successFg">
              {t('business.businessInfo.locationSet')}
            </Text>
          </View>
        ) : null}
        {save.error && !locationError ? (
          <Text font="semibold" className="text-[15px] text-dangerFg">
            {t(errorMessageKey(save.error))}
          </Text>
        ) : null}
      </View>
      <View className="min-h-6 flex-1" />
      <View className="px-4 pb-6 pt-2">
        <Button
          label={
            save.isSuccess ? t('business.businessInfo.saved') : t('business.businessInfo.save')
          }
          disabled={save.isPending}
          onPress={() => save.mutate()}
        />
      </View>
    </FormScreen>
  );
}
