import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  ChefHat,
  Info,
  Save,
  Shuffle,
  UserCog,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react-native';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { z } from 'zod';

import { Button } from '@/components/ui/Button';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { FormScreen } from '@/components/ui/FormScreen';
import { Input } from '@/components/ui/Input';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Switch } from '@/components/ui/Switch';
import { Text } from '@/components/ui/Text';
import { useBrandColors } from '@/store/theme';
import { ApiError } from '@/lib/api/client';
import { errorMessageKey } from '@/lib/errors';
import { digitsOnly, formatPhone, PHONE_DIGITS } from '@/lib/format';
import { addStaff, randomPin, staffKey, type StaffRole } from '@/lib/staff';
import { useSession } from '@/store/session';
import { colors } from '@/theme/tokens';

import { useRoleLabel, useWorkersOnly } from './roleLabel';

const STAFF_PIN_DIGITS = 4;

const schema = z.object({
  name: z.string().trim().min(2, 'staff.errors.name'),
  phone: z.string().regex(/^[79]\d{8}$/, 'auth.errors.phone'),
  pin: z.string().regex(/^\d{4}$/, 'staff.errors.pin'),
  role: z.enum(['waiter', 'chef', 'manager']),
  canChangeDeliveryFee: z.boolean(),
  canSeeReports: z.boolean(),
});

type Values = z.infer<typeof schema>;

const roleOptions: { role: StaffRole; icon: LucideIcon }[] = [
  { role: 'waiter', icon: UtensilsCrossed },
  { role: 'chef', icon: ChefHat },
  { role: 'manager', icon: UserCog },
];

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

export default function AddStaffScreen() {
  const brand = useBrandColors();
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isOwner = useSession((s) => s.user?.role === 'owner');
  const workersOnly = useWorkersOnly();
  const roleLabel = useRoleLabel();

  const {
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      phone: '',
      pin: '',
      role: 'waiter',
      canChangeDeliveryFee: false,
      canSeeReports: false,
    },
  });
  const role = useWatch({ control, name: 'role' });

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/staff'));
  const err = (message?: string) => (message ? t(message) : undefined);

  const mutation = useMutation({
    mutationFn: (values: Values) => {
      const isWaiter = values.role === 'waiter';
      return addStaff({
        name: values.name.trim(),
        phone: values.phone,
        pin: values.pin,
        role: values.role,
        // Only waiters use these two; managers can do both anyway.
        canChangeDeliveryFee: isWaiter && values.canChangeDeliveryFee,
        canSeeReports: isWaiter && values.canSeeReports,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: staffKey });
      goBack();
    },
    onError: (error) => {
      // A taken phone number is shown under the phone field, not as a popup.
      const phoneTaken =
        (error instanceof ApiError && error.code === 'PHONE_TAKEN') ||
        (error instanceof Error && error.message === 'PHONE_TAKEN');
      if (phoneTaken) {
        setError('phone', { message: 'staff.errors.phoneTaken' });
        mutation.reset();
      }
    },
  });

  const save = handleSubmit((values) => {
    if (values.role === 'manager' && !isOwner) return;
    mutation.mutate(values);
  });

  return (
    <FormScreen>
      <ScreenHeader title={t('staff.addTitle')} subtitle={t('staff.addSubtitle')} onBack={goBack} />

      <View className="gap-3.5 px-4 pt-2">
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <Input
              label={t('staff.fullName')}
              placeholder={t('staff.fullNamePlaceholder')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              autoCapitalize="words"
              error={err(errors.name?.message)}
            />
          )}
        />

        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <Input
              label={t('staff.phone')}
              prefix="+251"
              placeholder={t('auth.phonePlaceholder')}
              value={formatPhone(field.value)}
              onChangeText={(text) => field.onChange(digitsOnly(text, PHONE_DIGITS))}
              onBlur={field.onBlur}
              keyboardType="number-pad"
              maxLength={11}
              error={err(errors.phone?.message)}
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
              <View className="flex-row gap-2" accessibilityRole="radiogroup">
                {(workersOnly ? roleOptions.filter((o) => o.role === 'waiter') : roleOptions).map(
                  ({ role: value, icon: Icon }) => {
                    const selected = field.value === value;
                    const disabled = value === 'manager' && !isOwner;
                    return (
                      <Pressable
                        key={value}
                        onPress={() => field.onChange(value)}
                        disabled={disabled}
                        accessibilityRole="radio"
                        accessibilityState={{ selected, disabled }}
                        className={`h-[76px] flex-1 items-center justify-center gap-1 rounded-[18px] ${
                          selected ? 'bg-primary' : 'border-2 border-borderStrong bg-surface'
                        } ${disabled ? 'opacity-40' : ''}`}
                      >
                        <Icon
                          size={24}
                          color={selected ? colors.surface : brand.primary}
                          strokeWidth={2.2}
                        />
                        <Text
                          font="bold"
                          tone={selected ? 'inverse' : 'default'}
                          className="text-base"
                        >
                          {roleLabel(value)}
                        </Text>
                      </Pressable>
                    );
                  }
                )}
              </View>
            )}
          />
        </View>

        <View className="gap-1.5">
          <Controller
            control={control}
            name="pin"
            render={({ field }) => (
              <Input
                label={t('staff.pin')}
                placeholder={t('staff.pinPlaceholder')}
                value={field.value}
                onChangeText={(text) => field.onChange(digitsOnly(text, STAFF_PIN_DIGITS))}
                onBlur={field.onBlur}
                keyboardType="number-pad"
                maxLength={STAFF_PIN_DIGITS}
                error={err(errors.pin?.message)}
              />
            )}
          />
          <View className="flex-row items-start gap-2">
            <Info size={18} color={brand.primaryText} strokeWidth={2.2} />
            <Text tone="muted" className="flex-1 text-sm leading-5">
              {t('staff.pinNote')}
            </Text>
          </View>
          <Button
            label={t('staff.generatePin')}
            icon={Shuffle}
            variant="outline"
            size="md"
            onPress={() => setValue('pin', randomPin(), { shouldValidate: true })}
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
                onChange={field.onChange}
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
                onChange={field.onChange}
                last
              />
            )}
          />
        </View>
      ) : null}

      <View className="min-h-6 flex-1" />

      <ErrorDialog
        visible={mutation.isError}
        title={t('staff.saveFailedTitle')}
        message={t(errorMessageKey(mutation.error))}
        actionLabel={t('errors.retry')}
        onClose={mutation.reset}
      />

      <View className="gap-2.5 px-4 pb-6 pt-3">
        <Button
          label={t('staff.save')}
          icon={Save}
          disabled={mutation.isPending}
          onPress={() => void save()}
        />
        <Button label={t('staff.cancel')} variant="outline" size="md" onPress={goBack} />
      </View>
    </FormScreen>
  );
}
