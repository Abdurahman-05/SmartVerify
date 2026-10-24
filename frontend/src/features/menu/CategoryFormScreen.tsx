import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Save } from 'lucide-react-native';
import { useEffect } from 'react';
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
import { errorMessageKey } from '@/lib/errors';

import { categoryKinds, type CategoryKind } from './categoryKinds';

const schema = z.object({
  name: z.string().trim().min(1, 'categories.errors.name').max(40, 'categories.errors.name'),
  nameAm: z.string().trim().max(40),
});

type Values = z.infer<typeof schema>;

/** Add a category, or rename one when opened with `?id=`. Works for menu and table categories. */
export default function CategoryFormScreen({ kind = 'menu' }: { kind?: CategoryKind }) {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const config = categoryKinds[kind];
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const { data: categories, isPending } = useQuery({
    queryKey: config.queryKey,
    queryFn: config.list,
    enabled: isEdit,
  });
  const existing = categories?.find((category) => category.id === id);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', nameAm: '' },
  });

  // Fill the form once the category is known (edit mode).
  useEffect(() => {
    if (existing) reset({ name: existing.name, nameAm: existing.nameAm ?? '' });
  }, [existing, reset]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace(config.listRoute));

  const mutation = useMutation({
    mutationFn: (values: Values) => {
      const name = values.name.trim();
      const nameAm = values.nameAm.trim();
      return id
        ? config.update(id, { name, nameAm: nameAm || null })
        : config.add({ name, ...(nameAm && { nameAm }) });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: config.refreshKey });
      goBack();
    },
  });

  if (isEdit && isPending) {
    return <LoadingView screenTitle={t('categories.editTitle')} onBack={goBack} />;
  }

  return (
    <FormScreen>
      <ScreenHeader
        title={t(isEdit ? 'categories.editTitle' : 'categories.addTitle')}
        subtitle={t('categories.formSubtitle')}
        onBack={goBack}
      />

      <View className="gap-3.5 px-4 pt-2">
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <Input
              label={t('categories.name')}
              placeholder={t(
                kind === 'menu' ? 'categories.namePlaceholder' : 'categories.tableNamePlaceholder'
              )}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              autoCapitalize="words"
              maxLength={40}
              error={errors.name?.message ? t(errors.name.message) : undefined}
            />
          )}
        />
        <Controller
          control={control}
          name="nameAm"
          render={({ field }) => (
            <Input
              label={t('categories.nameAm')}
              placeholder={t(
                kind === 'menu'
                  ? 'categories.nameAmPlaceholder'
                  : 'categories.tableNameAmPlaceholder'
              )}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              maxLength={40}
            />
          )}
        />
      </View>

      <View className="min-h-6 flex-1" />

      <ErrorDialog
        visible={mutation.isError}
        title={t('categories.saveFailedTitle')}
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
