import { clearPasscode, useAppLock } from '@/lib/appLock';
import { signOut as signOutRequest } from '@/lib/auth';
import { queryClient } from '@/lib/queryClient';
import { useSession } from '@/store/session';

/**
 * A full sign-out: the server ends the session and this phone forgets the sign-in and the saved
 * lists. Next time: phone + PIN. Each person's passcode stays on the phone (it opens nothing
 * without that sign-in), so switching accounts never asks for a new one. forgetPasscode: after
 * too many wrong passcodes, this person's passcode and fingerprint are removed.
 */
export async function signOutCompletely({ forgetPasscode = false } = {}) {
  const userId = useSession.getState().user?.userId;
  await signOutRequest();
  if (forgetPasscode && userId) await clearPasscode(userId);
  else useAppLock.getState().unlock();
  useSession.getState().signOut();
  queryClient.clear();
}
