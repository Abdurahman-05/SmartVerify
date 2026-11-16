import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  ChefHat,
  Info,
  Mail,
  Save,
  Send,
  Shuffle,
  UserCog,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react-native';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { z } from 'zod';

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
import { randomPin, staffKey, type StaffRole } from '@/lib/staff';
import { createStaff, inviteManager } from '@/services/authService';
import { useSession } from '@/store/session';
import { colors } from '@/theme/tokens';

import { useRoleLabel, useWorkersOnly } from './roleLabel';
import { useInvites } from './invites';
import { isStaffLimit, StaffLimitSheet } from './StaffLimitSheet';
import { GlassCard, PrimaryButton, SecondaryButton } from '@/ui/glass';

/** Waiters and chefs get a PIN of 4 to 6 digits from the owner or manager. */
const STAFF_PIN_MAX = 6;

const schema = z
  .object({
    name: z.string().trim().min(2, 'staff.errors.name'),
    email: z.string(),
    phone: z.string().regex(/^[79]\d{8}$/, 'auth.errors.phone'),
    pin: z.string(),
    role: z.enum(['waiter', 'chef', 'manager']),
    canChangeDeliveryFee: z.boolean(),
    canSeeReports: z.boolean(),
  })
  .superRefine((v, ctx) => {
    // A manager is invited by email and sets their own PIN; waiters and chefs get a PIN, no email.
    if (v.role === 'manager') {
      if (!z.email().max(254).safeParse(v.email.trim()).success) {
        ctx.addIssue({ code: 'custom', path: ['email'], message: 'auth.errors.email' });
      }
    } else if (!/^\d{4,6}$/.test(v.pin)) {
      ctx.addIssue({ code: 'custom', path: ['pin'], message: 'staff.errors.pin' });
    }
  });

type Values = z.infer<typeof schema>;

const roleOptions: { role: StaffRole; icon: LucideIcon }[] = [
  { role: 'manager', icon: UserCog },
  { role: 'waiter', icon: UtensilsCrossed },
  { role: 'chef', icon: ChefHat },
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
  const addInvite = useInvites((s) => s.add);
  const isOwner = useSession((s) => s.user?.role === 'owner');
  const workersOnly = useWorkersOnly();
  const roleLabel = useRoleLabel();

  const {
    control,
    handleSubmit,
    setError,
    setValue,
    clearErrors,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      email: '',
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
    mutationFn: async (values: Values) => {
      if (values.role === 'manager') {
        const email = values.email.trim().toLowerCase();
        const invite = await inviteManager({
          name: values.name.trim(),
          email,
          phone: values.phone,
        });
        addInvite(invite, t('staff.inviteSentTo', { email }));
        return invite;
      }
      const isWaiter = values.role === 'waiter';
      return createStaff({
        name: values.name.trim(),
        phone: values.phone,
        pin: values.pin,
        role: values.role,
        // Only waiters use these two.
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
        <View className="gap-1.5">
          <Text font="bold" className="text-base">
            {t('staff.role')}
          </Text>
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <View className="flex-row gap-2" accessibilityRole="radiogroup">
                {roleOptions
                  // Only the owner can add a manager; Normal plans have one kind of staff.
                  .filter((o) =>
                    workersOnly ? o.role === 'waiter' : o.role !== 'manager' || isOwner
                  )
                  .map(({ role: value, icon: Icon }) => {
                    const selected = field.value === value;
                    const disabled = false;
                    return (
                      <Pressable
                        key={value}
                        onPress={() => {
                          field.onChange(value);
                          // Email is for managers only: hide and clear it for the other roles.
                          if (value !== 'manager') setValue('email', '');
                          clearErrors(['email', 'pin']);
                        }}
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
                  })}
              </View>
            )}
          />
        </View>

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

        {role === 'manager' ? (
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <Input
                label={t('staff.email')}
                labelIcon={Mail}
                labelIconColor={brand.primary}
                placeholder={t('auth.emailPlaceholder')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                error={err(errors.email?.message)}
              />
            )}
          />
        ) : null}

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

        {role === 'manager' ? (
          <View className="flex-row items-start gap-2">
            <Info size={18} color={brand.primaryText} strokeWidth={2.2} />
            <Text tone="muted" className="flex-1 text-sm leading-5">
              {t('staff.inviteNote')}
            </Text>
          </View>
        ) : (
          <View className="gap-1.5">
            <Controller
              control={control}
              name="pin"
              render={({ field }) => (
                <Input
                  label={t('staff.pin')}
                  placeholder={t('staff.pinPlaceholder')}
                  value={field.value}
                  onChangeText={(text) => field.onChange(digitsOnly(text, STAFF_PIN_MAX))}
                  onBlur={field.onBlur}
                  keyboardType="number-pad"
                  maxLength={STAFF_PIN_MAX}
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
            <SecondaryButton
              label={t('staff.generatePin')}
              icon={Shuffle}
              size="md"
              onPress={() => setValue('pin', randomPin(), { shouldValidate: true })}
            />
          </View>
        )}
      </View>

      {role === 'waiter' && !workersOnly ? (
        <GlassCard className="mx-4 mt-3 px-4 py-0.5">
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
        </GlassCard>
      ) : null}

      <View className="min-h-6 flex-1" />

      <StaffLimitSheet visible={isStaffLimit(mutation.error)} onClose={mutation.reset} />
      <ErrorDialog
        visible={mutation.isError && !isStaffLimit(mutation.error)}
        title={t('staff.saveFailedTitle')}
        message={t(errorMessageKey(mutation.error))}
        actionLabel={t('errors.retry')}
        onClose={mutation.reset}
      />

      <View className="gap-2.5 px-4 pb-6 pt-3">
        <PrimaryButton
          label={role === 'manager' ? t('staff.sendInvite') : t('staff.addButton')}
          icon={role === 'manager' ? Send : Save}
          disabled={mutation.isPending}
          onPress={() => void save()}
        />
        <SecondaryButton label={t('staff.cancel')} size="md" onPress={goBack} />
      </View>
    </FormScreen>
  );
}
