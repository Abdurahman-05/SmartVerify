import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { Check, EllipsisVertical, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BankBadge } from '@/components/ui/BankBadge';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { LoadingView } from '@/components/ui/LoadingView';
import { NoConnection } from '@/components/ui/NoConnection';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  bankAccountsKey,
  getBankAccounts,
  MAX_BANK_ACCOUNTS,
  removeBankAccount,
  type BankAccount,
} from '@/lib/bankAccounts';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { colors } from '@/theme/tokens';

import { useBrandColors } from '@/store/theme';

import { maskedNumberKey } from './telebirr';
import { GlassCard, PrimaryButton, ScreenBg, SecondaryButton } from '@/ui/glass';

function UsageCard({ count }: { count: number }) {
  const { t } = useTranslation();
  return (
    <GlassCard
      accessible
      accessibilityLabel={`${t('bankAccounts.connected')}: ${t('bankAccounts.used', { count, max: MAX_BANK_ACCOUNTS })}`}
      className="mx-4 mt-1 px-4 py-3"
    >
      <View className="mb-2 flex-row items-center justify-between gap-2">
        <Text font="bold" className="text-[17px]">
          {t('bankAccounts.connected')}
        </Text>
        <Text font="bold" tone="link" className="text-[15px]">
          {t('bankAccounts.used', { count, max: MAX_BANK_ACCOUNTS })}
        </Text>
      </View>
      <View className="flex-row gap-[5px]">
        {Array.from({ length: MAX_BANK_ACCOUNTS }, (_, i) => (
          <View
            key={i}
            className={`h-2 flex-1 rounded ${i < count ? 'bg-primary' : 'bg-borderMid'}`}
          />
        ))}
      </View>
    </GlassCard>
  );
}

/** Card colours per bank (design: each account is a card in its bank's colours). */
const bankGradient: Record<string, readonly [string, string, string]> = {
  CBE: ['#7B3FB0', '#5B2A86', '#3A1A5C'],
  TEL: ['#4A9BF0', '#1F7AE0', '#0F4E99'],
  DAS: ['#3F86C9', '#1B5E9C', '#0F3D6B'],
  BOA: ['#D9AE3A', '#B8860B', '#7A5A08'],
  MPE: ['#4CC160', '#2E9E45', '#1D6B2E'],
  EBR: ['#F29A45', '#E07A1F', '#A4540F'],
};

function AccountRow({ account, onMore }: { account: BankAccount; onMore: () => void }) {
  const { t } = useTranslation();
  const brand = useBrandColors();
  const fill = bankGradient[account.bankCode] ?? ([brand.primaryDeep, brand.primaryDeep] as const);
  return (
    <View
      className="overflow-hidden rounded-card p-4"
      style={{ boxShadow: '0 14px 28px rgba(30,20,25,0.2)' }}
    >
      <LinearGradient
        colors={fill}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0.1 }}
        end={{ x: 1, y: 0.9 }}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />
      <View className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
      <View className="flex-row items-center justify-between gap-2">
        <Text font="bold" tone="inverse" className="flex-1 text-base" numberOfLines={1}>
          {account.bankName}
        </Text>
        <Pressable
          onPress={onMore}
          accessibilityRole="button"
          accessibilityLabel={t('bankAccounts.moreOptions', { bank: account.bankName })}
          hitSlop={6}
          className="-mr-2 h-11 w-11 items-center justify-center rounded-full active:bg-white/20"
        >
          <EllipsisVertical size={22} color="#FFFFFF" strokeWidth={2.5} />
        </Pressable>
      </View>
      <Text font="heading" tone="inverse" className="mt-3 text-[22px] tracking-[2px]">
        {t(maskedNumberKey(account.bankCode), { last4: account.last4 })}
      </Text>
      <View className="mt-2.5 flex-row items-center justify-between gap-2">
        <Text tone="inverse" className="flex-1 text-sm opacity-90" numberOfLines={1}>
          {account.holderName}
        </Text>
        <View className="h-[26px] flex-row items-center gap-1 rounded-[13px] bg-white/20 px-2.5">
          <Check size={13} color="#FFFFFF" strokeWidth={2.8} />
          <Text font="bold" tone="inverse" className="text-[13px]">
            {t('bankAccounts.statusConnected')}
          </Text>
        </View>
      </View>
    </View>
  );
}

function AccountActions({
  account,
  onEdit,
  onRemove,
  onClose,
}: {
  account: BankAccount | null;
  onEdit: (account: BankAccount) => void;
  onRemove: (account: BankAccount) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  return (
    <Modal
      visible={account !== null}
      transparent
      animationType={reducedMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/40"
        onPress={onClose}
        accessibilityLabel={t('verify.scan.close')}
      />
      <SafeAreaView edges={['bottom']} className="gap-3 rounded-t-card bg-surface px-4 pb-3 pt-4">
        {account ? (
          <>
            <View className="flex-row items-center gap-3">
              <BankBadge code={account.bankCode} size={44} />
              <View className="flex-1">
                <Text font="heading" className="text-lg" numberOfLines={1}>
                  {account.holderName}
                </Text>
                <Text tone="muted" className="text-[15px]" numberOfLines={1}>
                  {account.bankName} ·{' '}
                  {t(maskedNumberKey(account.bankCode), { last4: account.last4 })}
                </Text>
              </View>
            </View>
            <GlassCard
              onPress={() => onEdit(account)}
              accessibilityRole="button"
              className="min-h-14 flex-row items-center gap-3 border-2 px-4"
            >
              <Pencil size={22} color={colors.text} strokeWidth={2.2} />
              <Text font="bold" className="text-lg">
                {t('bankAccounts.edit')}
              </Text>
            </GlassCard>
            <Pressable
              onPress={() => onRemove(account)}
              accessibilityRole="button"
              className="min-h-14 flex-row items-center gap-3 rounded-[18px] border-2 border-dangerBg bg-dangerSurface px-4 active:bg-dangerBg"
            >
              <Trash2 size={22} color={colors.dangerFg} strokeWidth={2.2} />
              <Text font="bold" className="text-lg text-dangerFg">
                {t('bankAccounts.remove')}
              </Text>
            </Pressable>
            <SecondaryButton label={t('bankAccounts.cancel')} size="md" onPress={onClose} />
          </>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

export default function BankAccountsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [menuFor, setMenuFor] = useState<BankAccount | null>(null);
  const query = useQuery({ queryKey: bankAccountsKey, queryFn: getBankAccounts });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );
  const remove = useMutation({
    mutationFn: removeBankAccount,
    onSuccess: () => queryClient.invalidateQueries(),
  });

  if (query.isError && !query.data && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void refetch()} />;
  }
  const accounts = query.data;
  if (query.isError && !accounts) {
    return (
      <ScreenBg>
        <SafeAreaView className="flex-1 items-center justify-center gap-4 px-6">
          <Text font="semibold" className="text-center text-lg">
            {t(errorMessageKey(query.error))}
          </Text>
          <View className="w-full">
            <PrimaryButton
              label={t('errors.retry')}
              icon={RefreshCw}
              onPress={() => void refetch()}
            />
          </View>
        </SafeAreaView>
      </ScreenBg>
    );
  }

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/home'));

  if (query.isPending || !accounts || remove.isPending)
    return <LoadingView screenTitle={t('bankAccounts.title')} onBack={goBack} />;

  const atLimit = accounts.length >= MAX_BANK_ACCOUNTS;
  const addAccount = () => router.push('/add-bank-account');

  const confirmRemove = (account: BankAccount) => {
    setMenuFor(null);
    Alert.alert(
      t('bankAccounts.removeTitle'),
      t('bankAccounts.removeBody', { bank: account.bankName, last4: account.last4 }),
      [
        { text: t('bankAccounts.cancel'), style: 'cancel' },
        {
          text: t('bankAccounts.remove'),
          style: 'destructive',
          onPress: () => remove.mutate(account.id),
        },
      ]
    );
  };

  return (
    <ScreenBg>
      <SafeAreaView className="flex-1">
        <ScreenHeader
          title={t('bankAccounts.title')}
          subtitle={t('bankAccounts.subtitle')}
          onBack={goBack}
        />

        <UsageCard count={accounts.length} />

        <FlatList
          data={accounts}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ gap: 12, padding: 16, paddingTop: 12 }}
          renderItem={({ item }) => <AccountRow account={item} onMore={() => setMenuFor(item)} />}
          ListEmptyComponent={
            <Text tone="muted" className="px-4 pt-8 text-center text-lg">
              {t('bankAccounts.empty')}
            </Text>
          }
        />

        <View className="gap-2 px-4 pb-3 pt-2.5">
          {atLimit ? (
            <Text font="semibold" tone="muted" className="text-center text-[15px]">
              {t('bankAccounts.limitReached', { max: MAX_BANK_ACCOUNTS })}
            </Text>
          ) : null}
          <PrimaryButton
            label={t('bankAccounts.addAccount')}
            icon={Plus}
            disabled={atLimit}
            onPress={addAccount}
          />
        </View>

        <AccountActions
          account={menuFor}
          onEdit={(account) => {
            setMenuFor(null);
            router.push({ pathname: '/add-bank-account', params: { id: account.id } });
          }}
          onRemove={confirmRemove}
          onClose={() => setMenuFor(null)}
        />
        <ErrorDialog
          visible={remove.isError}
          title={t('common.error')}
          message={t(errorMessageKey(remove.error))}
          actionLabel={t('errors.retry')}
          onClose={remove.reset}
        />
      </SafeAreaView>
    </ScreenBg>
  );
}
