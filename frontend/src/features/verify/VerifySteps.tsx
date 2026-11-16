import { Check } from 'lucide-react-native';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { GlassCard } from '@/components/ui/GlassCard';
import { useGlass } from '@/components/ui/glassTokens';
import { Text } from '@/components/ui/Text';
import { colors } from '@/theme/tokens';

const steps = ['bank', 'receipt', 'check'] as const;
/** A finished step: green circle with a tick, and a green bar after it. */
const DONE = '#22C55E';

/** 1 Bank — 2 Receipt — 3 Check in a glass pill: current step deep theme colour, done green. */
export function VerifySteps({ current }: { current: 1 | 2 | 3 }) {
  const { t } = useTranslation();
  const g = useGlass();
  return (
    <View className="px-4">
      <GlassCard
        radius={26}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      >
        <View
          className="flex-1 flex-row items-center"
          accessible
          accessibilityLabel={t('verifyBank.stepOf', {
            step: current,
            name: t(`verifyBank.steps.${steps[current - 1]}`),
          })}
        >
          {steps.map((step, i) => {
            const n = i + 1;
            const done = n < current;
            const active = n === current;
            const color = done ? colors.successFg : active ? g.primaryText : colors.muted;
            return (
              <Fragment key={step}>
                {i > 0 ? (
                  <View
                    className="mx-2 h-1 flex-1 rounded-full"
                    style={{ backgroundColor: n <= current ? DONE : 'rgba(30,26,28,0.1)' }}
                  />
                ) : null}
                <View className="flex-row items-center gap-1.5">
                  <View
                    className="h-[26px] w-[26px] items-center justify-center rounded-full"
                    style={{
                      backgroundColor: done ? DONE : active ? g.primaryDeep : 'rgba(30,26,28,0.08)',
                    }}
                  >
                    {done ? (
                      <Check size={15} color="#FFFFFF" strokeWidth={3} />
                    ) : (
                      <Text
                        font="bold"
                        className="text-[13px]"
                        style={{ color: active ? '#FFFFFF' : colors.muted }}
                      >
                        {n}
                      </Text>
                    )}
                  </View>
                  <Text font="bold" className="text-sm" style={{ color }}>
                    {t(`verifyBank.steps.${step}`)}
                  </Text>
                </View>
              </Fragment>
            );
          })}
        </View>
      </GlassCard>
    </View>
  );
}
