import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';

import { Text } from '@/components/ui/Text';
import type { AccessStatus } from '@/lib/admin';
import { colors } from '@/theme/tokens';

/** Small building blocks shared by the console pages (web, desktop-first). */

export function PageTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View className="flex-row flex-wrap items-end justify-between gap-4">
      <View className="min-w-[260px] flex-1 gap-1">
        <Text font="heading" className="text-[32px]" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text tone="muted" className="text-[15px]">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <View
      className={`gap-4 rounded-[20px] border-[1.5px] border-border bg-surface p-6 ${className}`}
    >
      {children}
    </View>
  );
}

export function CardTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View className="flex-row flex-wrap items-start justify-between gap-3">
      <View className="flex-1 gap-0.5">
        <Text font="heading" className="text-xl">
          {title}
        </Text>
        {subtitle ? (
          <Text tone="muted" className="text-sm">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

type ChipTone = 'ok' | 'warn' | 'error' | 'neutral';
const chipStyle: Record<ChipTone, { box: string; text: string }> = {
  ok: { box: 'bg-successBg', text: 'text-successFg' },
  warn: { box: 'bg-warnBg', text: 'text-warnFg' },
  error: { box: 'bg-dangerBg', text: 'text-dangerFg' },
  neutral: { box: 'bg-neutralBg', text: 'text-text' },
};

export function Chip({ label, tone = 'neutral' }: { label: string; tone?: ChipTone }) {
  return (
    <View
      className={`min-h-7 max-w-full flex-row items-center self-start rounded-[14px] px-2.5 py-1 ${chipStyle[tone].box}`}
    >
      <Text font="bold" className={`shrink text-sm ${chipStyle[tone].text}`}>
        {label}
      </Text>
    </View>
  );
}

export const statusTone: Record<AccessStatus, ChipTone> = {
  trial: 'neutral',
  active: 'ok',
  grace: 'warn',
  restricted: 'error',
  suspended: 'error',
};

/** "Active · 7 days left", "Overdue · grace · 4 days" … */
export function StatusChip({
  status,
  daysLeft,
  exempt,
}: {
  status: AccessStatus;
  daysLeft: number | null;
  exempt?: boolean;
}) {
  const { t } = useTranslation();
  const days =
    daysLeft === null
      ? ''
      : daysLeft > 0
        ? t('platformAdmin.statusLine.daysLeft', { count: daysLeft })
        : daysLeft === 0
          ? t('platformAdmin.statusLine.today')
          : t('platformAdmin.statusLine.overdue', { count: -daysLeft });
  const label = [
    t(`platformAdmin.status.${status}`),
    exempt ? t('platformAdmin.statusLine.exempt') : days,
  ]
    .filter(Boolean)
    .join(' · ');
  return <Chip label={label} tone={statusTone[status]} />;
}

export function Tabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { key: T; label: string; count?: number }[];
  onChange: (key: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2.5" accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            className={`h-11 flex-row items-center gap-2 rounded-[22px] border-2 px-4 ${
              on ? 'border-primary bg-primary' : 'border-border bg-surface'
            }`}
          >
            <Text font="semibold" tone={on ? 'inverse' : 'default'} className="text-[15px]">
              {o.label}
            </Text>
            {o.count !== undefined ? (
              <Text tone={on ? 'inverse' : 'muted'} className="text-sm">
                {o.count}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

type Variant = 'primary' | 'outline' | 'danger';
const buttonStyle: Record<Variant, { box: string; tone: 'inverse' | 'default'; color: string }> = {
  primary: { box: 'bg-primary', tone: 'inverse', color: colors.surface },
  outline: { box: 'border-2 border-borderStrong bg-surface', tone: 'default', color: colors.text },
  danger: { box: 'border-2 border-dangerBg bg-surface', tone: 'default', color: colors.dangerFg },
};

/** A compact button (44 high) for toolbars and cards. */
export function ActionButton({
  label,
  onPress,
  variant = 'outline',
  icon: Icon,
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: LucideIcon;
  disabled?: boolean;
}) {
  const s = buttonStyle[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      className={`h-11 flex-row items-center justify-center gap-2 rounded-[14px] px-4 ${s.box} ${
        disabled ? 'opacity-50' : 'active:opacity-80'
      }`}
    >
      {Icon ? <Icon size={18} color={s.color} strokeWidth={2.2} /> : null}
      <Text
        font="bold"
        tone={s.tone}
        className={`text-[15px] ${variant === 'danger' ? 'text-dangerFg' : ''}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  ...input
}: TextInputProps & { label: string; hint?: string; hideLabel?: boolean }) {
  const { hideLabel, ...rest } = input;
  return (
    <View className="gap-1.5">
      {!hideLabel ? (
        <Text font="bold" className="text-[15px]">
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.placeholder}
        accessibilityLabel={label}
        className="min-h-12 rounded-[14px] border-2 border-borderStrong bg-surface px-3.5 py-2 font-body text-base text-text"
        {...rest}
      />
      {hint ? (
        <Text tone="muted" className="text-sm">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/** A label/value line in a details card. */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="flex-row flex-wrap items-center gap-3 border-t-[1.5px] border-divider py-3">
      <Text tone="muted" className="w-[150px] text-[15px]">
        {label}
      </Text>
      <View className="min-w-[160px] flex-1">{children}</View>
    </View>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View className="rounded-[14px] bg-dangerBg px-4 py-3" accessibilityLiveRegion="polite">
      <Text font="semibold" className="text-[15px] text-dangerFg">
        {message}
      </Text>
    </View>
  );
}

const locale = (lang: string) => (lang === 'am' ? 'am-ET' : 'en-GB');
export const fmtDate = (iso: string | null, lang: string) =>
  iso
    ? new Date(iso).toLocaleDateString(locale(lang), {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '–';
export const fmtDateTime = (iso: string | null, lang: string) =>
  iso
    ? new Date(iso).toLocaleString(locale(lang), {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '–';
