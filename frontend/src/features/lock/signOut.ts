import { clearPasscode } from '@/lib/appLock';
import { signOut as signOutRequest } from '@/lib/auth';
import { queryClient } from '@/lib/queryClient';
import { useSession } from '@/store/session';

/**
 * A full sign-out: the server ends the session, this phone forgets the account, its passcode and
 * fingerprint, and the saved lists. Next time: phone + PIN (then a new passcode).
 */
export async function signOutCompletely() {
  await signOutRequest();
  await clearPasscode();
  useSession.getState().signOut();
  queryClient.clear();
}
