import { useTranslation } from 'react-i18next';

import { useSession, type Role } from '@/store/session';

/** On the Normal plans there are only workers: the waiter role is shown as "Worker". */
export const useWorkersOnly = () => useSession((s) => s.user?.plan !== 'restaurant');

export function useRoleLabel() {
  const { t } = useTranslation();
  const workersOnly = useWorkersOnly();
  return (role: Role) => t(workersOnly && role === 'waiter' ? 'roles.worker' : `roles.${role}`);
}
