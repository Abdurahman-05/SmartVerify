import { Check, ChevronDown, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BankBadge } from '@/components/ui/BankBadge';
import { Text } from '@/components/ui/Text';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { BankAccount } from '@/lib/mock/bankAccounts';
import { colors } from '@/theme/tokens';

function AccountText({ account }: { account: BankAccount }) {
  const { t } = useTranslation();
  return (
    <View className="flex-1">
      <Text font="bold" className="text-lg leading-tight">
        {account.bankName}
      </Text>
      <Text tone="muted" className="mt-0.5 text-base">
        {t('verify.accountMasked', { last4: account.last4 })}
      </Text>
    </View>
  );
}

interface AccountPickerProps {
  accounts: BankAccount[];
  selected: BankAccount;
  onSelect: (account: BankAccount) => void;
  onAddAccount: () => void;
}

export function AccountPicker({ accounts, selected, onSelect, onAddAccount }: AccountPickerProps) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${selected.bankName}, ${t('verify.accountMasked', { last4: selected.last4 })}. ${t('verify.chooseAccount')}`}
        className="flex-row items-center gap-3 rounded-[18px] border-2 border-primary bg-surface px-3.5 py-3 active:bg-background"
      >
        <BankBadge code={selected.bankCode} />
        <AccountText account={selected} />
        <ChevronDown size={26} color={colors.text} strokeWidth={2} />
      </Pressable>

      <Pressable
        onPress={onAddAccount}
        accessibilityRole="button"
        className="h-11 flex-row items-center gap-1.5 self-start rounded-[22px] border-2 border-borderStrong bg-surface pl-3 pr-4 active:bg-background"
      >
        <Plus size={20} color={colors.primaryText} strokeWidth={2.6} />
        <Text font="bold" tone="link" className="text-base">
          {t('verify.addAccount')}
        </Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType={reducedMotion ? 'none' : 'slide'}
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/40"
          onPress={() => setOpen(false)}
          accessibilityLabel={t('verify.scan.close')}
        />
        <SafeAreaView edges={['bottom']} className="rounded-t-card bg-surface px-4 pt-4">
          <Text font="heading" className="pb-3 text-xl" accessibilityRole="header">
            {t('verify.chooseAccount')}
          </Text>
          <View className="gap-2 pb-3">
            {accounts.map((account) => {
              const isSelected = account.id === selected.id;
              return (
                <Pressable
                  key={account.id}
                  onPress={() => {
                    onSelect(account);
                    setOpen(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  className={`flex-row items-center gap-3 rounded-[18px] px-3.5 py-3 ${
                    isSelected ? 'border-2 border-primary bg-primarySoft' : 'border-2 border-border bg-surface'
                  }`}
                >
                  <BankBadge code={account.bankCode} />
                  <AccountText account={account} />
                  {isSelected ? <Check size={24} color={colors.primary} strokeWidth={3} /> : null}
                </Pressable>
              );
            })}
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}
