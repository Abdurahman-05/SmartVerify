import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Minus, Plus } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Checkbox } from '@/components/ui/Checkbox';
import { NoConnection } from '@/components/ui/NoConnection';
import { SmallSpinner } from '@/components/ui/Spinner';
import { Switch } from '@/components/ui/Switch';
import { Text } from '@/components/ui/Text';
import {
  getSettingsPage,
  saveSettings,
  type PlatformSettings,
  type RestrictedBlock,
  type SettingsPage,
} from '@/lib/admin';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { colors } from '@/theme/tokens';

import { AdminShell } from './AdminShell';
import { ActionButton, Card, CardTitle, Chip, ErrorNote, Field, PageTitle } from './ui';

const BLOCKS: RestrictedBlock[] = ['receipt_checks', 'orders', 'reports', 'staff'];

function Stepper({
  value,
  onChange,
  min,
  max,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  label: string;
}) {
  const { t } = useTranslation();
  const btn = (delta: number, Icon: typeof Plus, a11y: string) => (
    <Pressable
      onPress={() => onChange(Math.min(max, Math.max(min, value + delta)))}
      accessibilityRole="button"
      accessibilityLabel={`${a11y}: ${label}`}
      className="h-11 w-11 items-center justify-center rounded-xl border-2 border-borderStrong bg-surface"
    >
      <Icon size={18} color={colors.text} strokeWidth={2.4} />
    </Pressable>
  );
  return (
    <View className="flex-row items-center gap-2">
      {btn(-1, Minus, t('platformAdmin.rules.decrease'))}
      <Text
        font="heading"
        className="w-12 text-center text-xl"
        accessibilityLabel={`${label}: ${value}`}
      >
        {value}
      </Text>
      {btn(1, Plus, t('platformAdmin.rules.increase'))}
      <Text tone="muted" className="text-[15px]">
        {t('platformAdmin.common.days')}
      </Text>
    </View>
  );
}

function Step({
  n,
  title,
  body,
  children,
}: {
  n: number;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <View className="flex-row flex-wrap items-center gap-4 border-t-[1.5px] border-divider py-4">
      <View className="h-9 w-9 items-center justify-center rounded-full bg-primary">
        <Text font="bold" tone="inverse" className="text-base">
          {n}
        </Text>
      </View>
      <View className="min-w-[200px] flex-1">
        <Text font="bold" className="text-base">
          {title}
        </Text>
        <Text tone="muted" className="text-sm">
          {body}
        </Text>
      </View>
      {children}
    </View>
  );
}

/** How new businesses start (trial) and what happens step by step when a payment is late. */
export default function RulesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const page = useQuery({ queryKey: ['admin-settings'], queryFn: getSettingsPage });
  // Unsaved edits; until the first edit the page shows what is saved.
  const [edits, setEdits] = useState<PlatformSettings | null>(null);
  const [remindersEdit, setReminders] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (s: PlatformSettings) => saveSettings(s),
    onSuccess: (saved) => {
      queryClient.setQueryData<SettingsPage>(['admin-settings'], (old) =>
        old ? { ...old, settings: saved } : old
      );
      setEdits(null);
      setReminders(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
    },
  });

  if (page.isError && !page.data && isNetworkError(page.error)) {
    return (
      <AdminShell>
        <NoConnection onRetry={() => void page.refetch()} />
      </AdminShell>
    );
  }
  if (!page.data) {
    return (
      <AdminShell>
        <View className="items-center py-10">
          <SmallSpinner />
        </View>
      </AdminShell>
    );
  }

  const draft = edits ?? page.data.settings;
  const reminders = remindersEdit ?? draft.reminderDays.join(', ');
  const reminderDays = [
    ...new Set(
      reminders
        .split(/[,\s]+/)
        .map(Number)
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 30)
    ),
  ].slice(0, 5);
  const next = { ...draft, reminderDays };
  const dirty = JSON.stringify(next) !== JSON.stringify(page.data.settings);
  const set = (patch: Partial<PlatformSettings>) => {
    save.reset();
    setEdits({ ...draft, ...patch });
  };

  const saveButton = (
    <View className="flex-row flex-wrap items-center gap-3">
      {dirty ? <Chip label={t('platformAdmin.common.unsaved')} tone="warn" /> : null}
      {save.isSuccess && !dirty ? <Chip label={t('platformAdmin.common.saved')} tone="ok" /> : null}
      <ActionButton
        label={t('platformAdmin.common.save')}
        variant="primary"
        disabled={!dirty || save.isPending}
        onPress={() => save.mutate(next)}
      />
    </View>
  );

  return (
    <AdminShell>
      <PageTitle
        title={t('platformAdmin.rules.title')}
        subtitle={t('platformAdmin.rules.subtitle')}
        right={saveButton}
      />
      <ErrorNote message={save.error ? t(errorMessageKey(save.error)) : null} />

      <Card>
        <View className="flex-row flex-wrap items-center gap-4">
          <View className="min-w-[220px] flex-1">
            <CardTitle
              title={t('platformAdmin.rules.trial')}
              subtitle={t('platformAdmin.rules.trialBody')}
            />
          </View>
          <Switch
            value={draft.trialEnabled}
            onValueChange={(v: boolean) => set({ trialEnabled: v })}
            accessibilityLabel={t('platformAdmin.rules.trial')}
          />
        </View>
        {draft.trialEnabled ? (
          <View className="flex-row flex-wrap items-center gap-4 border-t-[1.5px] border-divider pt-4">
            <Text font="bold" className="min-w-[160px] text-base">
              {t('platformAdmin.rules.trialLength')}
            </Text>
            <Stepper
              value={draft.trialDays}
              onChange={(v) => set({ trialDays: v })}
              min={1}
              max={90}
              label={t('platformAdmin.rules.trialLength')}
            />
            <Text tone="muted" className="text-sm">
              {t('platformAdmin.rules.trialNote')}
            </Text>
          </View>
        ) : null}
      </Card>

      <Card className="gap-0">
        <CardTitle
          title={t('platformAdmin.rules.late')}
          subtitle={t('platformAdmin.rules.lateBody')}
        />
        <View className="mt-4">
          <Step
            n={1}
            title={t('platformAdmin.rules.reminders')}
            body={t('platformAdmin.rules.remindersBody')}
          >
            <View className="w-[280px]">
              <Field
                label={t('platformAdmin.rules.reminders')}
                hideLabel
                hint={t('platformAdmin.rules.remindersHint')}
                value={reminders}
                onChangeText={setReminders}
              />
            </View>
          </Step>
          <Step
            n={2}
            title={t('platformAdmin.rules.grace')}
            body={t('platformAdmin.rules.graceBody')}
          >
            <Stepper
              value={draft.graceDays}
              onChange={(v) => set({ graceDays: v })}
              min={0}
              max={30}
              label={t('platformAdmin.rules.grace')}
            />
          </Step>
          <Step
            n={3}
            title={t('platformAdmin.rules.restricted')}
            body={t('platformAdmin.rules.restrictedBody')}
          >
            <Stepper
              value={draft.restrictedDays}
              onChange={(v) => set({ restrictedDays: v })}
              min={0}
              max={60}
              label={t('platformAdmin.rules.restricted')}
            />
          </Step>
          <Step
            n={4}
            title={t('platformAdmin.rules.suspended')}
            body={t('platformAdmin.rules.suspendedBody')}
          >
            <Text font="semibold" className="text-[15px]">
              {t('platformAdmin.rules.untilPaid')}
            </Text>
          </Step>
        </View>
      </Card>

      <View className="flex-row flex-wrap gap-[18px]">
        <Card className="min-w-[320px] flex-1">
          <CardTitle
            title={t('platformAdmin.rules.blocks')}
            subtitle={t('platformAdmin.rules.blocksBody')}
          />
          {BLOCKS.map((b) => {
            const on = draft.restrictedBlocks.includes(b);
            return (
              <Checkbox
                key={b}
                checked={on}
                onChange={(checked) =>
                  set({
                    restrictedBlocks: checked
                      ? [...draft.restrictedBlocks, b]
                      : draft.restrictedBlocks.filter((x) => x !== b),
                  })
                }
                accessibilityLabel={t(`platformAdmin.rules.blockNames.${b}`)}
              >
                <Text className="flex-1 text-[15px]">
                  {t(`platformAdmin.rules.blockNames.${b}`)}
                </Text>
              </Checkbox>
            );
          })}
        </Card>

        <Card className="min-w-[320px] flex-1">
          <CardTitle
            title={t('platformAdmin.rules.exceptions')}
            subtitle={t('platformAdmin.rules.exceptionsBody')}
          />
          {page.data.exceptions.length === 0 ? (
            <Text tone="muted" className="text-[15px]">
              {t('platformAdmin.rules.exceptionsNone')}
            </Text>
          ) : (
            page.data.exceptions.map((e) => (
              <Pressable
                key={e.businessId}
                onPress={() => router.push(`/customers/${e.businessId}`)}
                accessibilityRole="link"
                className="min-h-11 flex-row flex-wrap items-center gap-3 border-t-[1.5px] border-divider py-3"
              >
                <Text font="bold" className="flex-1 text-[15px]">
                  {e.name}
                </Text>
                {e.reason ? (
                  <Text tone="muted" className="text-sm">
                    {e.reason}
                  </Text>
                ) : null}
              </Pressable>
            ))
          )}
        </Card>
      </View>

      <View className="flex-row flex-wrap items-center justify-between gap-4 rounded-2xl bg-primarySoft px-5 py-4">
        <Text font="semibold" className="min-w-[240px] flex-1 text-[15px]">
          {t('platformAdmin.rules.impact', page.data.impact)}
        </Text>
        {saveButton}
      </View>
    </AdminShell>
  );
}
