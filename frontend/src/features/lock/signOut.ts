import { clearPasscode, useAppLock } from '@/lib/appLock';
import { signOut as signOutRequest } from '@/lib/auth';
import { queryClient } from '@/lib/queryClient';
import { useSession } from '@/store/session';

/**
 * A full sign-out: the server ends the session and this phone forgets the sign-in and the saved
 * lists. Next time: phone + PIN. The passcode stays for the same person (it opens nothing without
 * that sign-in); someone else signing in makes their own. forgetPasscode: after too many wrong
 * passcodes, the passcode and fingerprint are removed too.
 */
export async function signOutCompletely({ forgetPasscode = false } = {}) {
  await signOutRequest();
  if (forgetPasscode) await clearPasscode();
  else useAppLock.getState().unlock();
  useSession.getState().signOut();
  queryClient.clear();
}
