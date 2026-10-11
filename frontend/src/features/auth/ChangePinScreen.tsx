import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { CircleCheck, KeyRound } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { FormScreen } from '@/components/ui/FormScreen';
import { Input } from '@/components/ui/Input';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { ApiError } from '@/lib/api/client';
import { changePin } from '@/lib/auth';
import { errorMessageKey } from '@/lib/errors';
import { digitsOnly } from '@/lib/format';
import { useSession } from '@/store/session';
import { colors } from '@/theme/tokens';

import { PinVisibilityButton } from './PinVisibilityButton';
import { PIN_LENGTH, STAFF_PIN_LENGTH } from './schemas';

type Field = 'current' | 'next' | 'again';

/** Change your own PIN (owner 6 digits, staff 4). */
export default function ChangePinScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const role = useSession((s) => s.user?.role);
  const length = role === 'owner' ? PIN_LENGTH : STAFF_PIN_LENGTH;
  const [values, setValues] = useState<Record<Field, string>>({ current: '', next: '', again: '' });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: () => changePin(values.current, values.next),
    onSuccess: () => {
      setSaved(true);
      setValues({ current: '', next: '', again: '' });
    },
    onError: (error) => {
      // A wrong current PIN is shown under that field, not as a popup.
      if (error instanceof ApiError && error.code === 'WRONG_CREDENTIALS') {
        setErrors({ current: 'pin.errors.currentWrong' });
        mutation.reset();
      }
    },
  });

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/profile'));
  const set = (field: Field) => (text: string) => {
    setSaved(false);
    setValues((v) => ({ ...v, [field]: digitsOnly(text, length) }));
  };

  const save = () => {
    Keyboard.dismiss();
    const next: Partial<Record<Field, string>> = {};
    if (values.current.length !== length) next.current = 'pin.errors.length';
    if (values.next.length !== length) next.next = 'pin.errors.length';
    else if (values.next === values.current) next.next = 'pin.errors.same';
    if (!next.next && values.again !== values.next) next.again = 'pin.errors.mismatch';
    setErrors(next);
    if (Object.keys(next).length === 0) mutation.mutate();
  };

  const err = (field: Field) => (errors[field] ? t(errors[field], { count: length }) : undefined);
  const pinInput = (field: Field, label: string) => (
    <Input
      label={label}
      placeholder={t('pin.digits', { count: length })}
      value={values[field]}
      onChangeText={set(field)}
      keyboardType="number-pad"
      secureTextEntry={!show}
      maxLength={length}
      rightAccessory={<PinVisibilityButton visible={show} onToggle={() => setShow((v) => !v)} />}
      error={err(field)}
    />
  );

  return (
    <FormScreen>
      <ScreenHeader
        title={t('pin.changeTitle')}
        subtitle={t('pin.changeSubtitle')}
        onBack={goBack}
      />

      <View className="gap-3.5 px-4 pt-2">
        {saved ? (
          <View
            className="flex-row items-start gap-2 rounded-[16px] bg-successBg p-3"
            accessibilityLiveRegion="polite"
          >
            <CircleCheck size={22} color={colors.successFg} strokeWidth={2.2} />
            <Text font="bold" className="flex-1 text-base" style={{ color: colors.successFg }}>
              {t('pin.saved')}
            </Text>
          </View>
        ) : null}
        {pinInput('current', t('pin.current'))}
        {pinInput('next', t('pin.new'))}
        {pinInput('again', t('pin.confirm'))}
      </View>

      <View className="min-h-6 flex-1" />

      <View className="gap-2.5 px-4 pb-6 pt-3">
        <Button
          label={t('pin.save')}
          icon={KeyRound}
          disabled={mutation.isPending}
          onPress={save}
        />
        <Button label={t('common.cancel')} variant="outline" size="md" onPress={goBack} />
      </View>

      <ErrorDialog
        visible={mutation.isError}
        title={t('pin.failedTitle')}
        message={t(errorMessageKey(mutation.error))}
        actionLabel={t('errors.retry')}
        onClose={mutation.reset}
      />
    </FormScreen>
  );
}
