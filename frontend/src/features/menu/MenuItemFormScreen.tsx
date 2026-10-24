import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Save } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Keyboard, View } from 'react-native';
import { z } from 'zod';

import { Button } from '@/components/ui/Button';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { FormScreen } from '@/components/ui/FormScreen';
import { Input } from '@/components/ui/Input';
import { LoadingView } from '@/components/ui/LoadingView';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { Pill } from '@/features/orders/Pill';
import { newIdempotencyKey } from '@/lib/api/idempotency';
import { errorMessageKey } from '@/lib/errors';
import { digitsOnly } from '@/lib/format';
import { addMenuItem, getMenuItems, menuAdminKey, updateMenuItem } from '@/lib/menu';
import { getMenuCategories, itemCategoryKey, menuCategoriesKey } from '@/lib/menuCategories';
import { colors } from '@/theme/tokens';

import { useLocalName } from './useLocalName';

const MAX_PRICE_DIGITS = 7;

const schema = z.object({
  name: z.string().trim().min(1, 'menuAdmin.errors.name').max(80, 'menuAdmin.errors.name'),
  price: z.string().refine((v) => Number(v) >= 1, 'menuAdmin.errors.price'),
  categoryId: z.string().min(1, 'menuAdmin.errors.category'),
});

type Values = z.infer<typeof schema>;

/** Add a menu item, or edit one when opened with `?id=`. */
export default function MenuItemFormScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = Boolean(id);
  // One key per opened form: a retried "add" of the same item is saved once.
  const [idempotencyKey] = useState(newIdempotencyKey);

  const { data: items, isPending } = useQuery({
    queryKey: menuAdminKey,
    queryFn: getMenuItems,
    enabled: isEdit,
  });
  const existing = items?.find((item) => item.id === id);
  const localName = useLocalName();
  const categoriesQuery = useQuery({ queryKey: menuCategoriesKey, queryFn: getMenuCategories });
  const categories = categoriesQuery.data ?? [];

  const {
    control,
    handleSubmit,
    reset,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', price: '', categoryId: '' },
  });

  // Fill the form once the item is known (edit mode).
  useEffect(() => {
    if (existing) {
      reset({
        name: existing.name,
        price: String(existing.priceEtb),
        categoryId: itemCategoryKey(existing),
      });
    }
  }, [existing, reset]);

  // A new item starts in the first category.
  const firstCategoryId = categories[0]?.id;
  useEffect(() => {
    if (!isEdit && firstCategoryId && !getValues('categoryId')) {
      setValue('categoryId', firstCategoryId);
    }
  }, [isEdit, firstCategoryId, getValues, setValue]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/menu'));

  const mutation = useMutation({
    mutationFn: (values: Values) => {
      const chosen = categories.find((c) => c.id === values.categoryId);
      const input = {
        name: values.name.trim(),
        priceEtb: Number(values.price),
        categoryId: values.categoryId,
        category: chosen?.kind ?? 'food',
      };
      return id ? updateMenuItem(id, input) : addMenuItem(input, idempotencyKey);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['menu'] });
      goBack();
    },
  });

  if ((isEdit && isPending) || categoriesQuery.isPending) {
    return (
      <LoadingView
        screenTitle={t(isEdit ? 'menuAdmin.editTitle' : 'menuAdmin.addTitle')}
        onBack={goBack}
      />
    );
  }

  const err = (message?: string) => (message ? t(message) : undefined);

  return (
    <FormScreen>
      <ScreenHeader
        title={t(isEdit ? 'menuAdmin.editTitle' : 'menuAdmin.addTitle')}
        subtitle={t('menuAdmin.formSubtitle')}
        onBack={goBack}
      />

      <View className="gap-3.5 px-4 pt-2">
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <Input
              label={t('menuAdmin.name')}
              placeholder={t('menuAdmin.namePlaceholder')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              autoCapitalize="words"
              maxLength={80}
              error={err(errors.name?.message)}
            />
          )}
        />

        <Controller
          control={control}
          name="price"
          render={({ field }) => (
            <Input
              label={t('menuAdmin.price')}
              placeholder="0"
              value={field.value}
              onChangeText={(text) => field.onChange(digitsOnly(text, MAX_PRICE_DIGITS))}
              onBlur={field.onBlur}
              keyboardType="number-pad"
              maxLength={MAX_PRICE_DIGITS}
              error={err(errors.price?.message)}
            />
          )}
        />

        <View className="gap-1.5">
          <Text font="bold" className="text-base">
            {t('menuAdmin.category')}
          </Text>
          <Controller
            control={control}
            name="categoryId"
            render={({ field }) => (
              <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
                {categories.map((c) => (
                  <Pill
                    key={c.id}
                    label={localName(c)}
                    selected={field.value === c.id}
                    onPress={() => field.onChange(c.id)}
                  />
                ))}
              </View>
            )}
          />
          {errors.categoryId?.message ? (
            <Text className="text-sm" style={{ color: colors.dangerFg }}>
              {t(errors.categoryId.message)}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="min-h-6 flex-1" />

      <ErrorDialog
        visible={mutation.isError}
        title={t('menuAdmin.saveFailedTitle')}
        message={t(errorMessageKey(mutation.error))}
        actionLabel={t('errors.retry')}
        onClose={mutation.reset}
      />

      <View className="gap-2.5 px-4 pb-6 pt-3">
        <Button
          label={t('common.save')}
          icon={Save}
          disabled={mutation.isPending}
          onPress={() => {
            Keyboard.dismiss();
            void handleSubmit((values) => mutation.mutate(values))();
          }}
        />
        <Button label={t('common.cancel')} variant="outline" size="md" onPress={goBack} />
      </View>
    </FormScreen>
  );
}
