import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { SecureFooter } from '@/components/ui/SecureFooter';
import { Text } from '@/components/ui/Text';
import { useBrandColors } from '@/store/theme';
import { homeRouteFor, useSession } from '@/store/session';
import { colors } from '@/theme/tokens';

const DESIGN_WIDTH = 390;
const HERO_HEIGHT = 380;
const SPLASH_MS = 1600;

export default function SplashScreen() {
  const brand = useBrandColors();
  const { t } = useTranslation();
  const router = useRouter();
  const isAuthenticated = useSession((s) => s.isAuthenticated);
  const role = useSession((s) => s.user?.role);
  const { width } = useWindowDimensions();
  const scale = width / DESIGN_WIDTH;

  useEffect(() => {
    const timer = setTimeout(
      () => router.replace(isAuthenticated ? homeRouteFor(role) : '/sign-in'),
      SPLASH_MS
    );
    return () => clearTimeout(timer);
  }, [isAuthenticated, role, router]);

  return (
    <View className="flex-1 bg-background">
      <StatusBar style="light" />
      <Svg
        width={width}
        height={HERO_HEIGHT * scale}
        viewBox={`0 0 ${DESIGN_WIDTH} ${HERO_HEIGHT}`}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <Defs>
          <RadialGradient id="glow" cx="195" cy="190" r="170" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#2E8C66" stopOpacity={0.95} />
            <Stop offset="0.55" stopColor="#1B6A4B" stopOpacity={0.6} />
            <Stop offset="1" stopColor={brand.primary} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Path d="M0 0H390V330C330 300 270 310 200 338C130 366 60 372 0 340Z" fill={brand.primary} />
        <Circle cx={195} cy={190} r={170} fill="url(#glow)" />
        <Circle
          cx={195}
          cy={190}
          r={120}
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity={0.12}
          strokeWidth={1.5}
        />
        <Circle
          cx={195}
          cy={190}
          r={190}
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity={0.08}
          strokeWidth={1.5}
        />
      </Svg>

      <SafeAreaView edges={['bottom']} className="flex-1 items-center">
        <View
          className="h-32 w-32 items-center justify-center rounded-[34px] bg-surface"
          style={{
            marginTop: 318 * scale,
            shadowColor: brand.primary,
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.28,
            shadowRadius: 15,
            elevation: 10,
          }}
        >
          <Svg width={84} height={84} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 2.5l8.5 3.2v6.3c0 5.2-3.6 8.6-8.5 9.9-4.9-1.3-8.5-4.7-8.5-9.9V5.7z"
              fill={brand.primary}
            />
            <Path
              d="M8 12.2l2.9 2.9 5.3-5.8"
              stroke={colors.accent}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>

        <View className="mt-7 items-center px-6">
          <View className="flex-row items-start gap-1.5">
            <Text font="heading" className="text-4xl" accessibilityRole="header">
              {t('brand.name')}
            </Text>
            <View className="mt-3 h-2.5 w-2.5 rounded-full bg-accentDeep" />
          </View>
          <Text font="medium" tone="muted" className="mt-2 text-center text-[19px]">
            {t('brand.tagline')}
          </Text>
        </View>

        <View className="flex-1" />

        <View className="mb-12 flex-row gap-2.5">
          <View className="h-[11px] w-[11px] rounded-full bg-primary" />
          <View className="h-[11px] w-[11px] rounded-full bg-primary" />
          <View className="h-[11px] w-[11px] rounded-full border-[1.5px] border-accentDeep bg-accent" />
        </View>

        <View className="pb-9">
          <SecureFooter />
        </View>
      </SafeAreaView>
    </View>
  );
}
