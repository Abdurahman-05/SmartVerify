import { useTranslation } from 'react-i18next';

import { isNormalApp } from '@/lib/variant';
import { useSession, type Role } from '@/store/session';

/** On the Normal plans there is one kind of staff (the waiter role, shown as "Worker" in the Shop app). */
export const useWorkersOnly = () => useSession((s) => s.user?.plan !== 'restaurant');

export function useRoleLabel() {
  const { t } = useTranslation();
  const workersOnly = useWorkersOnly();
  return (role: Role) =>
    t(workersOnly && isNormalApp && role === 'waiter' ? 'roles.worker' : `roles.${role}`);
}
