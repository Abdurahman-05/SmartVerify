import { Delete, Fingerprint } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { PASSCODE_LENGTH } from '@/lib/appLock';
import { useBrandColors } from '@/store/theme';
import { colors } from '@/theme/tokens';

/** The filled / empty dots above the keys. */
export function PasscodeDots({ count, error }: { count: number; error?: boolean }) {
  const brand = useBrandColors();
  return (
    <View
      className="flex-row justify-center gap-4"
      accessible
      accessibilityLabel={`${count} / ${PASSCODE_LENGTH}`}
    >
      {Array.from({ length: PASSCODE_LENGTH }, (_, i) => (
        <View
          key={i}
          className="h-[18px] w-[18px] rounded-full border-2"
          style={{
            borderColor: error ? colors.dangerFg : brand.primary,
            backgroundColor: i < count ? (error ? colors.dangerFg : brand.primary) : 'transparent',
          }}
        />
      ))}
    </View>
  );
}

function Key({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-[72px] w-[72px] items-center justify-center rounded-full bg-surface active:bg-border"
    >
      {children}
    </Pressable>
  );
}

/**
 * Number keys like a bank app. Adds a digit until the passcode is complete, then calls onDone.
 * onFingerprint shows the fingerprint key (bottom left).
 */
export function PasscodePad({
  value,
  onChange,
  onDone,
  onFingerprint,
}: {
  value: string;
  onChange: (value: string) => void;
  onDone: (value: string) => void;
  onFingerprint?: () => void;
}) {
  const { t } = useTranslation();
  const brand = useBrandColors();
  const press = (digit: string) => {
    if (value.length >= PASSCODE_LENGTH) return;
    const next = value + digit;
    onChange(next);
    if (next.length === PASSCODE_LENGTH) onDone(next);
  };
  const rows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
  ];
  return (
    <View className="items-center gap-3">
      {rows.map((row) => (
        <View key={row[0]} className="flex-row gap-6">
          {row.map((d) => (
            <Key key={d} label={d} onPress={() => press(d)}>
              <Text font="heading" className="text-[28px]">
                {d}
              </Text>
            </Key>
          ))}
        </View>
      ))}
      <View className="flex-row gap-6">
        {onFingerprint ? (
          <Key label={t('lock.useFingerprint')} onPress={onFingerprint}>
            <Fingerprint size={30} color={brand.primary} strokeWidth={2} />
          </Key>
        ) : (
          <View className="h-[72px] w-[72px]" />
        )}
        <Key label="0" onPress={() => press('0')}>
          <Text font="heading" className="text-[28px]">
            0
          </Text>
        </Key>
        <Key label={t('lock.delete')} onPress={() => onChange(value.slice(0, -1))}>
          <Delete size={28} color={colors.text} strokeWidth={2} />
        </Key>
      </View>
    </View>
  );
}
