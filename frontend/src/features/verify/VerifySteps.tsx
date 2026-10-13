import { Check } from 'lucide-react-native';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors } from '@/theme/tokens';

const steps = ['bank', 'receipt', 'check'] as const;

/** 1 Bank — 2 Receipt — 3 Check, with the current step dark and earlier ones ticked. */
export function VerifySteps({ current }: { current: 1 | 2 | 3 }) {
  const { t } = useTranslation();
  return (
    <View
      className="flex-row items-center px-5 pt-1.5"
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
        return (
          <Fragment key={step}>
            {i > 0 ? <View className="mx-2 h-[3px] flex-1 rounded-full bg-borderStrong" /> : null}
            <View className="flex-row items-center gap-1.5">
              <View
                className={`h-7 w-7 items-center justify-center rounded-full ${
                  done ? 'bg-primaryText' : active ? 'bg-primary' : 'bg-border'
                }`}
              >
                {done ? (
                  <Check size={16} color={colors.surface} strokeWidth={3} />
                ) : (
                  <Text font="heading" tone={active ? 'inverse' : 'muted'} className="text-[15px]">
                    {n}
                  </Text>
                )}
              </View>
              <Text
                font="bold"
                className={`text-[15px] ${
                  done ? 'text-primaryText' : active ? 'text-text' : 'text-placeholder'
                }`}
              >
                {t(`verifyBank.steps.${step}`)}
              </Text>
            </View>
          </Fragment>
        );
      })}
    </View>
  );
}
