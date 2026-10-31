import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CircleCheck, KeyRound, Power, Save, Shuffle } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert, Keyboard, View } from 'react-native';
import { z } from 'zod';

import { Button } from '@/components/ui/Button';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { FormScreen } from '@/components/ui/FormScreen';
import { Input } from '@/components/ui/Input';
import { LoadingView } from '@/components/ui/LoadingView';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Switch } from '@/components/ui/Switch';
import { Text } from '@/components/ui/Text';
import { Pill } from '@/features/orders/Pill';
import { errorMessageKey } from '@/lib/errors';
import { digitsOnly, formatPhone } from '@/lib/format';
import {
  getStaff,
  randomPin,
  resetStaffPin,
  staffKey,
  updateStaff,
  type StaffMember,
  type StaffRole,
} from '@/lib/staff';
import { useSession } from '@/store/session';
import { colors } from '@/theme/tokens';

import { useRoleLabel, useWorkersOnly } from './roleLabel';
import { isStaffLimit, StaffLimitSheet } from './StaffLimitSheet';

import { ActivePill, RolePill } from './StaffScreen';

const STAFF_PIN_DIGITS = 4;

const schema = z.object({
  name: z.string().trim().min(2, 'staff.errors.name'),
  role: z.enum(['waiter', 'chef', 'manager']),
  canChangeDeliveryFee: z.boolean(),
  canSeeReports: z.boolean(),
});
type Values = z.infer<typeof schema>;

function PermissionRow({
  label,
  value,
  onChange,
  last,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <View
      className={`min-h-14 flex-row items-center gap-3 py-3 ${last ? '' : 'border-b-[1.5px] border-divider'}`}
    >
      <Text font="semibold" className="flex-1 text-[17px]">
        {label}
      </Text>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} />
    </View>
  );
}

/** The person's details, filled once they are known. Keyed by id so it resets between people. */
function StaffForm({ member }: { member: StaffMember }) {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isOwner = useSession((s) => s.user?.role === 'owner');
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/staff'));
  const refresh = () => queryClient.invalidateQueries({ queryKey: staffKey });

  const workersOnly = useWorkersOnly();
  const roleLabel = useRoleLabel();
  const roles: StaffRole[] = workersOnly
    ? ['waiter']
    : isOwner
      ? ['waiter', 'chef', 'manager']
      : ['waiter', 'chef'];

  const { control, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: member.name,
      role: member.role,
      canChangeDeliveryFee: member.canChangeDeliveryFee,
      canSeeReports: member.canSeeReports,
    },
  });
  const role = useWatch({ control, name: 'role' });
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: (values: Values) =>
      updateStaff(member.id, {
        name: values.name.trim(),
        role: values.role,
        // Only waiters use these two; managers can do both anyway.
        canChangeDeliveryFee: values.role === 'waiter' && values.canChangeDeliveryFee,
        canSeeReports: values.role === 'waiter' && values.canSeeReports,
      }),
    onSuccess: () => {
      setSaved(true);
      void refresh();
    },
  });

  const toggle = useMutation({
    mutationFn: (active: boolean) => updateStaff(member.id, { active }),
    onSuccess: () => {
      void refresh();
      goBack();
    },
  });

  // Reset a forgotten PIN: the new temporary PIN is shown once, to be told to the person.
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [resetDone, setResetDone] = useState<string | null>(null);
  const reset = useMutation({
    mutationFn: (value: string) => resetStaffPin(member.id, value),
    onSuccess: (_result, value) => {
      setResetDone(value);
      setPin('');
      void refresh();
    },
  });
  const submitReset = () => {
    Keyboard.dismiss();
    if (pin.length !== STAFF_PIN_DIGITS) {
      setPinError(true);
      return;
    }
    setPinError(false);
    reset.mutate(pin);
  };

  const confirmToggle = () => {
    const turningOff = member.active;
    Alert.alert(
      t(turningOff ? 'staff.setOffTitle' : 'staff.setActiveTitle', { name: member.name }),
      t(turningOff ? 'staff.setOffBody' : 'staff.setActiveBody'),
      [
        { text: t('staff.cancel'), style: 'cancel' },
        {
          text: t(turningOff ? 'staff.confirmOff' : 'staff.confirmActive'),
          style: turningOff ? 'destructive' : 'default',
          onPress: () => toggle.mutate(!turningOff),
        },
      ]
    );
  };

  const failed = save.isError ? save : toggle.isError ? toggle : reset.isError ? reset : null;
  const failedTitle = save.isError
    ? 'staff.saveFailedTitle'
    : toggle.isError
      ? 'staff.toggleFailedTitle'
      : 'staff.resetFailedTitle';
  const err = (message?: string) => (message ? t(message) : undefined);

  return (
    <FormScreen>
      <ScreenHeader
        title={member.name}
        subtitle={`+251 ${formatPhone(member.phone)}`}
        onBack={goBack}
      />

      <View className="flex-row flex-wrap gap-1.5 px-4 pb-1">
        <RolePill role={member.role} />
        <ActivePill active={member.active} />
      </View>

      {!member.editable ? (
        <View className="mx-4 mt-3 rounded-[16px] bg-neutralBg p-3">
          <Text font="semibold" className="text-base">
            {t('staff.readOnly')}
          </Text>
        </View>
      ) : (
        <>
          <View className="gap-3.5 px-4 pt-3">
            <Controller
              control={control}
              name="name"
              render={({ field }) => (
                <Input
                  label={t('staff.fullName')}
                  value={field.value}
                  onChangeText={(text) => {
                    setSaved(false);
                    field.onChange(text);
                  }}
                  onBlur={field.onBlur}
                  autoCapitalize="words"
                  error={err(formState.errors.name?.message)}
                />
              )}
            />
            <View className="gap-1.5">
              <Text font="bold" className="text-base">
                {t('staff.role')}
              </Text>
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
                    {roles.map((value) => (
                      <Pill
                        key={value}
                        label={roleLabel(value)}
                        selected={field.value === value}
                        onPress={() => {
                          setSaved(false);
                          field.onChange(value);
                        }}
                      />
                    ))}
                  </View>
                )}
              />
            </View>
          </View>

          {role === 'waiter' && !workersOnly ? (
            <View className="mx-4 mt-3 rounded-[20px] border-[1.5px] border-border bg-surface px-4 py-0.5">
              <Text font="bold" tone="muted" className="pt-2.5 text-[15px]">
                {t('staff.permissions')}
              </Text>
              <Controller
                control={control}
                name="canChangeDeliveryFee"
                render={({ field }) => (
                  <PermissionRow
                    label={t('staff.changeDeliveryFee')}
                    value={field.value}
                    onChange={(v) => {
                      setSaved(false);
                      field.onChange(v);
                    }}
                  />
                )}
              />
              <Controller
                control={control}
                name="canSeeReports"
                render={({ field }) => (
                  <PermissionRow
                    label={t('staff.seeReports')}
                    value={field.value}
                    onChange={(v) => {
                      setSaved(false);
                      field.onChange(v);
                    }}
                    last
                  />
                )}
              />
            </View>
          ) : null}

          <View className="gap-2.5 px-4 pt-4">
            {saved ? (
              <View
                className="flex-row items-center gap-2 rounded-[16px] bg-successBg p-3"
                accessibilityLiveRegion="polite"
              >
                <CircleCheck size={22} color={colors.successFg} strokeWidth={2.2} />
                <Text font="bold" className="flex-1 text-base" style={{ color: colors.successFg }}>
                  {t('staff.saved')}
                </Text>
              </View>
            ) : null}
            <Button
              label={t('common.save')}
              icon={Save}
              disabled={save.isPending}
              onPress={() => {
                Keyboard.dismiss();
                void handleSubmit((values) => save.mutate(values))();
              }}
            />
          </View>

          <View className="mx-4 mt-5 gap-2.5 rounded-[20px] border-[1.5px] border-border bg-surface p-4">
            <Text font="bold" className="text-[17px]">
              {t('staff.resetTitle')}
            </Text>
            <Text tone="muted" className="text-sm leading-5">
              {t('staff.resetBody')}
            </Text>
            {resetDone ? (
              <View
                className="gap-1 rounded-[16px] bg-successBg p-3"
                accessibilityLiveRegion="polite"
              >
                <Text font="bold" className="text-base" style={{ color: colors.successFg }}>
                  {t('staff.resetDone', { name: member.name })}
                </Text>
                <Text font="heading" className="text-[28px] tracking-widest">
                  {resetDone}
                </Text>
                <Text className="text-sm leading-5" style={{ color: colors.successFg }}>
                  {t('staff.resetDoneNote')}
                </Text>
              </View>
            ) : null}
            <Input
              label={t('staff.newTempPin')}
              placeholder={t('staff.pinPlaceholder')}
              value={pin}
              onChangeText={(text) => {
                setResetDone(null);
                setPin(digitsOnly(text, STAFF_PIN_DIGITS));
              }}
              keyboardType="number-pad"
              maxLength={STAFF_PIN_DIGITS}
              error={pinError ? t('staff.errors.pin') : undefined}
            />
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button
                  label={t('staff.generatePin')}
                  icon={Shuffle}
                  variant="outline"
                  size="md"
                  onPress={() => {
                    setResetDone(null);
                    setPinError(false);
                    setPin(randomPin());
                  }}
                />
              </View>
              <View className="flex-1">
                <Button
                  label={t('staff.resetAction')}
                  icon={KeyRound}
                  size="md"
                  disabled={reset.isPending}
                  onPress={submitReset}
                />
              </View>
            </View>
          </View>

          <View className="px-4 pb-6 pt-5">
            <Button
              label={t(member.active ? 'staff.deactivate' : 'staff.activate')}
              icon={Power}
              variant={member.active ? 'outline' : 'primary'}
              disabled={toggle.isPending}
              onPress={confirmToggle}
            />
          </View>
        </>
      )}

      <StaffLimitSheet visible={isStaffLimit(failed?.error)} onClose={() => failed?.reset()} />
      <ErrorDialog
        visible={Boolean(failed) && !isStaffLimit(failed?.error)}
        title={t(failedTitle)}
        message={t(errorMessageKey(failed?.error))}
        actionLabel={t('errors.retry')}
        onClose={() => failed?.reset()}
      />
    </FormScreen>
  );
}

/** One person: edit, reset a forgotten PIN, turn on/off. Opened from the Staff list. */
export default function StaffDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({ queryKey: staffKey, queryFn: getStaff });
  const member = query.data?.find((m) => m.id === id);
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/staff'));

  useEffect(() => {
    // Someone removed or opened from an old link: back to the list.
    if (query.isSuccess && !member) goBack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.isSuccess, member]);

  if (!member) return <LoadingView screenTitle={t('staff.title')} onBack={goBack} />;
  return <StaffForm key={member.id} member={member} />;
}
