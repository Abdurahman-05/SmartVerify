import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import {
  ChefHat,
  Info,
  Save,
  UserCog,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react-native';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { z } from 'zod';

import { Button } from '@/components/ui/Button';
import { FormScreen } from '@/components/ui/FormScreen';
import { Input } from '@/components/ui/Input';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Switch } from '@/components/ui/Switch';
import { Text } from '@/components/ui/Text';
import { useBrandColors } from '@/store/theme';
import { digitsOnly, formatPhone, PHONE_DIGITS } from '@/lib/format';
import { useSession } from '@/store/session';
import { colors } from '@/theme/tokens';

import { useStaff } from './store';
import type { Staff, StaffRole } from './types';

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

function buildStaff(values: Values): Staff {
  const isWaiter = values.role === 'waiter';
  const isManager = values.role === 'manager';
  return {
    id: `staff-${Date.now()}`,
    name: values.name.trim(),
    phone: values.phone,
    pin: values.pin,
    role: values.role,
    canChangeDeliveryFee: isManager || (isWaiter && values.canChangeDeliveryFee),
    canSeeReports: isManager || (isWaiter && values.canSeeReports),
    active: true,
  };
}

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
  const isOwner = useSession((s) => s.user?.role === 'owner');
  const addStaff = useStaff((s) => s.addStaff);

  const {
    control,
    handleSubmit,
    setError,
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

  const save = handleSubmit((values) => {
    const { owner, staff } = useStaff.getState();
    if (owner.phone === values.phone || staff.some((m) => m.phone === values.phone)) {
      setError('phone', { message: 'staff.errors.phoneTaken' });
      return;
    }
    if (values.role === 'manager' && !isOwner) return;
    addStaff(buildStaff(values));
    goBack();
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
                {roleOptions.map(({ role: value, icon: Icon }) => {
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
                        {t(`roles.${value}`)}
                      </Text>
                    </Pressable>
                  );
                })}
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
        </View>
      </View>

      {role === 'waiter' ? (
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

      <View className="gap-2.5 px-4 pb-6 pt-3">
        <Button label={t('staff.save')} icon={Save} onPress={save} />
        <Button label={t('staff.cancel')} variant="outline" size="md" onPress={goBack} />
      </View>
    </FormScreen>
  );
}
