import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { getBusinessProfile, updateBusinessProfile } from '@/lib/business';
import { errorMessageKey } from '@/lib/errors';
import { useSession } from '@/store/session';
import { colors } from '@/theme/tokens';

import { detectLocation } from './detectLocation';
import { GlassCard, PrimaryButton, SecondaryButton } from '@/ui/glass';

/** "Later" hides the card until the app is opened again. */
let skippedThisRun = false;

/** Home, owner only: asks once per app start for the shop's map location until it is saved. */
export function LocationPrompt() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isOwner = useSession((s) => s.user?.role === 'owner');
  const [hidden, setHidden] = useState(skippedThisRun);
  const [problem, setProblem] = useState<string | null>(null);
  const profile = useQuery({
    queryKey: ['business-profile'],
    queryFn: getBusinessProfile,
    enabled: isOwner,
  });

  const save = useMutation({
    mutationFn: async () => {
      setProblem(null);
      const found = await detectLocation();
      if (!found.ok) {
        setProblem(
          t(
            found.reason === 'denied'
              ? 'business.locationPrompt.denied'
              : 'business.locationPrompt.unavailable'
          )
        );
        return null;
      }
      return updateBusinessProfile({ location: found.location });
    },
    onSuccess: (saved) => {
      if (saved) queryClient.setQueryData(['business-profile'], saved);
    },
    onError: (error) => setProblem(t(errorMessageKey(error))),
  });

  if (!isOwner || hidden || !profile.data || profile.data.latitude !== null) return null;

  return (
    <GlassCard className="mx-4 mb-3 gap-3 p-4">
      <View className="flex-row items-center gap-3">
        <MapPin size={24} color={colors.primary} strokeWidth={2.2} />
        <Text font="semibold" className="flex-1 text-[15px]">
          {t('business.locationPrompt.message')}
        </Text>
      </View>
      {problem ? (
        <Text font="semibold" className="text-sm text-dangerFg">
          {problem}
        </Text>
      ) : null}
      <View className="flex-row gap-2">
        <View className="flex-1">
          <SecondaryButton
            label={t('business.locationPrompt.later')}
            size="md"
            onPress={() => {
              skippedThisRun = true;
              setHidden(true);
            }}
          />
        </View>
        <View className="flex-1">
          <PrimaryButton
            label={
              save.isPending
                ? t('business.locationPrompt.detecting')
                : t('business.locationPrompt.detect')
            }
            icon={MapPin}
            size="md"
            disabled={save.isPending}
            onPress={() => save.mutate()}
          />
        </View>
      </View>
    </GlassCard>
  );
}
