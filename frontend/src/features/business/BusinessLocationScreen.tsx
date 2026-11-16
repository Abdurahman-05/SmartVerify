import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { LocateFixed, MapPin } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Input } from '@/components/ui/Input';
import { LoadingView } from '@/components/ui/LoadingView';
import { NoConnection } from '@/components/ui/NoConnection';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { getBusinessLocation, updateBusinessLocation } from '@/lib/business';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { homeRouteFor, useSession } from '@/store/session';
import { useBrandColors } from '@/store/theme';
import { GlassCard, PrimaryButton, ScreenBg, SecondaryButton } from '@/ui/glass';

/** Addis Ababa, where the map opens until the owner has a point. */
const ADDIS = { latitude: 9.0192, longitude: 38.7525 };
const DELTA = 0.005;

type Fields = { address: string; city: string; area: string; landmark: string };
const EMPTY: Fields = { address: '', city: '', area: '', landmark: '' };

/** Turns the phone's reverse-geocode answer into the four editable fields. */
function fieldsFrom(place: Location.LocationGeocodedAddress | undefined): Fields {
  if (!place) return EMPTY;
  const street = [place.streetNumber, place.street].filter(Boolean).join(' ');
  // `name` is often the street number or the street again; keep it only when it is a place.
  const landmark =
    place.name && place.name !== place.street && !/^\d+$/.test(place.name) ? place.name : '';
  return {
    address: street || place.name || '',
    city: place.city ?? place.subregion ?? '',
    area: place.district ?? place.subregion ?? '',
    landmark,
  };
}

/**
 * "Where is your business?" Owner: a map with a pin in the middle (drag the map to move it),
 * "Use my location" to fill the point and the address fields, and Save. After sign-up it comes
 * before the plan ("Add later" skips it); from Profile it edits what is saved.
 */
export default function BusinessLocationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const brand = useBrandColors();
  const queryClient = useQueryClient();
  const user = useSession((s) => s.user);
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const firstRun = onboarding === '1';
  const saved = useQuery({ queryKey: ['business-location'], queryFn: getBusinessLocation });

  const map = useRef<MapView>(null);
  // Edits sit on top of what is saved, so nothing has to be copied into state.
  const data = saved.data;
  const [pointEdit, setPointEdit] = useState<{ latitude: number; longitude: number } | null>(null);
  const [fieldEdits, setFieldEdits] = useState<Partial<Fields>>({});
  const [locating, setLocating] = useState(false);
  const [denied, setDenied] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // The map and the page scroll with the same finger: the page waits while the map is touched.
  const [pageScroll, setPageScroll] = useState(true);

  const point = pointEdit ?? (data ? { latitude: data.lat, longitude: data.lng } : ADDIS);
  const fields: Fields = {
    address: data?.address ?? '',
    city: data?.city ?? '',
    area: data?.area ?? '',
    landmark: data?.landmark ?? '',
    ...fieldEdits,
  };

  const edit = (key: keyof Fields) => (value: string) =>
    setFieldEdits((f) => ({ ...f, [key]: value }));

  const locateMe = async () => {
    setLocating(true);
    setProblem(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        // No permission: the owner fills the fields (and moves the map) by hand.
        setDenied(true);
        return;
      }
      setDenied(false);
      const { coords } = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const here = { latitude: coords.latitude, longitude: coords.longitude };
      setPointEdit(here);
      map.current?.animateToRegion({ ...here, latitudeDelta: DELTA, longitudeDelta: DELTA }, 400);
      // The address is a help, not a must: without it the owner types the fields.
      const [place] = await Location.reverseGeocodeAsync(here).catch(() => []);
      setFieldEdits(fieldsFrom(place));
    } catch {
      setProblem(t('business.location.unavailable'));
    } finally {
      setLocating(false);
    }
  };

  const save = useMutation({
    mutationFn: () =>
      updateBusinessLocation({
        lat: point.latitude,
        lng: point.longitude,
        address: fields.address.trim(),
        city: fields.city.trim(),
        area: fields.area.trim(),
        landmark: fields.landmark.trim(),
      }),
    onSuccess: (location) => {
      queryClient.setQueryData(['business-location'], location);
      void queryClient.invalidateQueries({ queryKey: ['business-profile'] });
      finish();
    },
  });

  const finish = () => {
    if (firstRun) router.replace(homeRouteFor(useSession.getState().user));
    else if (router.canGoBack()) router.back();
    else router.replace('/profile');
  };

  if (user?.role !== 'owner') return <Redirect href="/profile" />;
  if (saved.isPending) return <LoadingView screenTitle={t('business.location.title')} />;
  if (saved.isError && !saved.data && isNetworkError(saved.error)) {
    return <NoConnection onRetry={() => void saved.refetch()} />;
  }

  const initial: Region = {
    ...point,
    latitudeDelta: DELTA,
    longitudeDelta: DELTA,
  };

  return (
    <ScreenBg>
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          <ScrollView
            scrollEnabled={pageScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1 }}
          >
            <ScreenHeader
              title={t('business.location.title')}
              subtitle={t('business.location.subtitle')}
              onBack={firstRun ? undefined : finish}
            />

            <View className="gap-3 px-4 pt-1">
              <GlassCard radius={22} className="overflow-hidden">
                <View
                  className="h-[280px]"
                  onTouchStart={() => setPageScroll(false)}
                  onTouchEnd={() => setPageScroll(true)}
                  onTouchCancel={() => setPageScroll(true)}
                >
                  <MapView
                    ref={map}
                    provider={PROVIDER_GOOGLE}
                    style={{ flex: 1 }}
                    initialRegion={initial}
                    onRegionChangeComplete={(region) =>
                      setPointEdit({ latitude: region.latitude, longitude: region.longitude })
                    }
                    toolbarEnabled={false}
                    accessibilityLabel={t('business.location.mapLabel')}
                  />
                  {/* The pin stays in the middle; its tip is the centre of the map. */}
                  <View
                    pointerEvents="none"
                    className="absolute inset-0 items-center justify-center"
                  >
                    <View style={{ marginBottom: 40 }}>
                      <MapPin
                        size={40}
                        color={brand.primaryDeep}
                        fill={brand.primaryDeep}
                        strokeWidth={1.5}
                      />
                    </View>
                  </View>
                </View>
              </GlassCard>

              <Text tone="muted" className="text-center text-sm">
                {t('business.location.dragHint')}
              </Text>

              <SecondaryButton
                label={locating ? t('business.location.finding') : t('business.location.useMine')}
                icon={LocateFixed}
                size="md"
                disabled={locating}
                onPress={() => void locateMe()}
              />
              {denied ? (
                <Text font="semibold" className="text-sm text-dangerFg">
                  {t('business.location.denied')}
                </Text>
              ) : null}
              {problem ? (
                <Text font="semibold" className="text-sm text-dangerFg">
                  {problem}
                </Text>
              ) : null}

              <Input
                label={t('business.location.address')}
                value={fields.address}
                onChangeText={edit('address')}
                placeholder={t('business.location.addressPlaceholder')}
                maxLength={200}
              />
              <Input
                label={t('business.location.city')}
                value={fields.city}
                onChangeText={edit('city')}
                maxLength={200}
              />
              <Input
                label={t('business.location.area')}
                value={fields.area}
                onChangeText={edit('area')}
                placeholder={t('business.location.areaPlaceholder')}
                maxLength={200}
              />
              <Input
                label={t('business.location.landmark')}
                value={fields.landmark}
                onChangeText={edit('landmark')}
                placeholder={t('business.location.landmarkPlaceholder')}
                maxLength={200}
              />

              {save.isError ? (
                <Text font="semibold" className="text-[15px] text-dangerFg">
                  {t(errorMessageKey(save.error))}
                </Text>
              ) : null}
            </View>

            <View className="min-h-6 flex-1" />
            <View className="gap-2.5 px-4 pb-6 pt-3">
              <PrimaryButton
                label={t('business.location.save')}
                disabled={save.isPending}
                onPress={() => save.mutate()}
              />
              {firstRun ? (
                <SecondaryButton label={t('business.location.later')} size="md" onPress={finish} />
              ) : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenBg>
  );
}
