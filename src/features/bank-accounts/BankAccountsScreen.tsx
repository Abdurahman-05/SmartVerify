import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Check, EllipsisVertical, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BankBadge } from '@/components/ui/BankBadge';
import { Button } from '@/components/ui/Button';
import { LoadingView } from '@/components/ui/LoadingView';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  getBankAccounts,
  MAX_BANK_ACCOUNTS,
  removeBankAccount,
  type BankAccount,
} from '@/lib/api/bankAccounts';
import { colors } from '@/theme/tokens';

function UsageCard({ count }: { count: number }) {
  const { t } = useTranslation();
  return (
    <View
      accessible
      accessibilityLabel={`${t('bankAccounts.connected')}: ${t('bankAccounts.used', { count, max: MAX_BANK_ACCOUNTS })}`}
      className="mx-4 mt-1 rounded-[18px] border-[1.5px] border-border bg-surface px-4 py-3"
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
          <View key={i} className={`h-2 flex-1 rounded ${i < count ? 'bg-primary' : 'bg-borderMid'}`} />
        ))}
      </View>
    </View>
  );
}

function AccountRow({ account, onMore }: { account: BankAccount; onMore: () => void }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-3 rounded-[18px] border-[1.5px] border-border bg-surface py-3 pl-3 pr-2">
      <BankBadge code={account.bankCode} />
      <View className="min-w-0 flex-1">
        <Text font="bold" className="text-[17px]">
          {account.bankName}
        </Text>
        <Text tone="muted" className="mb-1 mt-px text-[15px]">
          {t('verify.accountMasked', { last4: account.last4 })}
        </Text>
        <View className="flex-row items-center gap-1 self-start rounded-[14px] bg-successBg py-[3px] pl-2 pr-2.5">
          <Check size={14} color={colors.successFg} strokeWidth={2.6} />
          <Text font="bold" className="text-sm text-successFg">
            {t('bankAccounts.statusConnected')}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={onMore}
        accessibilityRole="button"
        accessibilityLabel={t('bankAccounts.moreOptions', { bank: account.bankName })}
        className="h-11 w-11 items-center justify-center rounded-full active:bg-border"
      >
        <EllipsisVertical size={22} color={colors.muted} strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

function AccountActions({
  account,
  onRemove,
  onClose,
}: {
  account: BankAccount | null;
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
      <Pressable className="flex-1 bg-black/40" onPress={onClose} accessibilityLabel={t('verify.scan.close')} />
      <SafeAreaView edges={['bottom']} className="gap-3 rounded-t-card bg-surface px-4 pb-3 pt-4">
        {account ? (
          <>
            <View className="flex-row items-center gap-3">
              <BankBadge code={account.bankCode} size={44} />
              <View className="flex-1">
                <Text font="heading" className="text-lg">
                  {account.bankName}
                </Text>
                <Text tone="muted" className="text-[15px]">
                  {t('verify.accountMasked', { last4: account.last4 })}
                </Text>
              </View>
            </View>
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
            <Button label={t('bankAccounts.cancel')} variant="secondary" size="md" onPress={onClose} />
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
  const { data: accounts, isPending } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: getBankAccounts,
  });
  const remove = useMutation({
    mutationFn: removeBankAccount,
    onSuccess: () => queryClient.invalidateQueries(),
  });

  if (isPending || !accounts || remove.isPending) return <LoadingView />;

  const atLimit = accounts.length >= MAX_BANK_ACCOUNTS;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/home'));
  const addAccount = () => router.push('/add-bank-account');

  const confirmRemove = (account: BankAccount) => {
    setMenuFor(null);
    Alert.alert(
      t('bankAccounts.removeTitle'),
      t('bankAccounts.removeBody', { bank: account.bankName, last4: account.last4 }),
      [
        { text: t('bankAccounts.cancel'), style: 'cancel' },
        { text: t('bankAccounts.remove'), style: 'destructive', onPress: () => remove.mutate(account.id) },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader
        title={t('bankAccounts.title')}
        subtitle={t('bankAccounts.subtitle')}
        onBack={goBack}
        right={
          <Pressable
            onPress={addAccount}
            disabled={atLimit}
            accessibilityRole="button"
            accessibilityLabel={t('bankAccounts.addAccount')}
            accessibilityState={{ disabled: atLimit }}
            className={`h-11 flex-row items-center gap-1 rounded-[22px] bg-primary pl-3 pr-4 ${atLimit ? 'opacity-50' : 'active:opacity-80'}`}
          >
            <Plus size={20} color={colors.surface} strokeWidth={2.8} />
            <Text font="bold" tone="inverse" className="text-base">
              {t('bankAccounts.add')}
            </Text>
          </Pressable>
        }
      />

      <UsageCard count={accounts.length} />

      <FlatList
        data={accounts}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ gap: 8, padding: 16, paddingTop: 12 }}
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
        <Button label={t('bankAccounts.addAccount')} icon={Plus} disabled={atLimit} onPress={addAccount} />
      </View>

      <AccountActions account={menuFor} onRemove={confirmRemove} onClose={() => setMenuFor(null)} />
    </SafeAreaView>
  );
}
