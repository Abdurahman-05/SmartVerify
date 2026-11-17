import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Link2, LocateFixed } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Input } from '@/components/ui/Input';
import { LoadingView } from '@/components/ui/LoadingView';
import { NoConnection } from '@/components/ui/NoConnection';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { getBusinessLocation, updateBusinessLocation } from '@/lib/business';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { homeRouteFor, useSession } from '@/store/session';
import { PrimaryButton, ScreenBg, SecondaryButton } from '@/ui/glass';

/**
 * "lat, lng" from what the owner pastes: a Google Maps link (…/@9.01,38.76,17z or …?q=9.01,38.76)
 * or the two numbers themselves. Short share links (maps.app.goo.gl) carry no numbers.
 */
function coordinatesOf(text: string): { lat: number; lng: number } | null {
  const match =
    /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/.exec(text) ??
    /[?&](?:q|ll|query)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/.exec(text) ??
    /^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/.exec(text);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

const isShortLink = (text: string) => /(maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(text);
const linkFor = (lat: number, lng: number) => `https://maps.google.com/?q=${lat},${lng}`;

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
 * "Where is your business?" Owner: a Google Maps link (pasted, or filled by "Use my location"),
 * the address fields, and Save. No map here (the Smart Verify team sees it on a map in the admin).
 * After sign-up it comes before the plan ("Add later" skips it); from Profile it edits what is saved.
 */
export default function BusinessLocationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useSession((s) => s.user);
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const firstRun = onboarding === '1';
  const saved = useQuery({ queryKey: ['business-location'], queryFn: getBusinessLocation });

  // Edits sit on top of what is saved, so nothing has to be copied into state.
  const data = saved.data;
  const [linkEdit, setLinkEdit] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | undefined>();
  const [fieldEdits, setFieldEdits] = useState<Partial<Fields>>({});
  const [locating, setLocating] = useState(false);
  const [denied, setDenied] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const link = linkEdit ?? (data ? linkFor(data.lat, data.lng) : '');
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
        // No permission: the owner pastes a link and fills the fields by hand.
        setDenied(true);
        return;
      }
      setDenied(false);
      const { coords } = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const here = { latitude: coords.latitude, longitude: coords.longitude };
      setLinkEdit(linkFor(Number(here.latitude.toFixed(6)), Number(here.longitude.toFixed(6))));
      setLinkError(undefined);
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
    mutationFn: (point: { lat: number; lng: number }) =>
      updateBusinessLocation({
        lat: point.lat,
        lng: point.lng,
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

  const submit = () => {
    const point = coordinatesOf(link.trim());
    if (!point) {
      setLinkError(
        t(
          !link.trim()
            ? 'business.location.linkMissing'
            : isShortLink(link)
              ? 'business.location.linkShort'
              : 'business.location.linkBad'
        )
      );
      return;
    }
    setLinkError(undefined);
    save.mutate(point);
  };

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

  return (
    <ScreenBg>
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          <ScrollView
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
              <Input
                label={t('business.location.link')}
                labelIcon={Link2}
                value={link}
                onChangeText={(text) => {
                  setLinkEdit(text);
                  setLinkError(undefined);
                }}
                placeholder={t('business.location.linkPlaceholder')}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                error={linkError}
              />
              <Text tone="muted" className="text-sm">
                {t('business.location.linkHint')}
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
                onPress={submit}
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
