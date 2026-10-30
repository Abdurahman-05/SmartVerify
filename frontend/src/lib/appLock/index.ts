import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

/**
 * App lock, like a bank app: after the first full sign-in the person makes a 4-digit passcode
 * (and may add a fingerprint). Opening the app, coming back after a while, or "Sign out" then
 * only asks for it, offline: it is checked on the phone, the remembered session stays.
 * The passcode lives in the phone's secure storage (encrypted by the system), never on the server.
 */
const PASSCODE_KEY = 'smartverify.passcode';
const BIOMETRIC_KEY = 'smartverify.biometric';
const TRIES_KEY = 'smartverify.passcodeTries';
const LOCK_AFTER_KEY = 'smartverify.lockAfter';

export const PASSCODE_LENGTH = 4;
/** After this many wrong passcodes the phone forgets the account: sign in with phone + PIN. */
export const MAX_TRIES = 5;
/**
 * Choices for "Ask for passcode after" (ms in the background). No "every time": opening the camera
 * or gallery (scanning or uploading a receipt) also leaves the app for a moment.
 */
export const LOCK_AFTER_CHOICES = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000] as const;
export type LockAfter = (typeof LOCK_AFTER_CHOICES)[number];
const DEFAULT_LOCK_AFTER: LockAfter = 60_000;

interface Saved {
  userId: string;
  code: string;
}

interface AppLockState {
  /** Read from storage (at start). */
  loaded: boolean;
  /** A sign-in is remembered on this phone (only then is there a lock). */
  remembered: boolean;
  /** Whose passcode is set here (another person signing in makes their own). */
  passcodeUserId: string | null;
  biometric: boolean;
  /** Back from the background after this long: locked again. */
  lockAfter: LockAfter;
  locked: boolean;
  tries: number;
  setRemembered: (remembered: boolean) => void;
  /** Locks when this person's passcode is set on a remembered phone. */
  lock: (userId: string | undefined) => void;
  unlock: () => void;
}

export const useAppLock = create<AppLockState>((set) => ({
  loaded: false,
  remembered: false,
  passcodeUserId: null,
  biometric: false,
  lockAfter: DEFAULT_LOCK_AFTER,
  locked: false,
  tries: 0,
  setRemembered: (remembered) => set({ remembered }),
  lock: (userId) =>
    set((s) => ({ locked: s.remembered && !!userId && s.passcodeUserId === userId })),
  unlock: () => set({ locked: false }),
}));

async function readSaved(): Promise<Saved | null> {
  try {
    const raw = await SecureStore.getItemAsync(PASSCODE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

/** Reads the lock settings once, at start. */
export async function loadAppLock() {
  const [saved, biometric, tries, lockAfter] = await Promise.all([
    readSaved(),
    SecureStore.getItemAsync(BIOMETRIC_KEY).catch(() => null),
    SecureStore.getItemAsync(TRIES_KEY).catch(() => null),
    SecureStore.getItemAsync(LOCK_AFTER_KEY).catch(() => null),
  ]);
  const chosen = LOCK_AFTER_CHOICES.find((c) => String(c) === lockAfter);
  useAppLock.setState({
    loaded: true,
    lockAfter: chosen ?? DEFAULT_LOCK_AFTER,
    passcodeUserId: saved?.userId ?? null,
    biometric: biometric === '1' && saved !== null,
    tries: Number(tries) || 0,
  });
}

/** The signed-in person must make a passcode first (a remembered sign-in without one). */
export const needsPasscode = (userId: string | undefined) => {
  const s = useAppLock.getState();
  return s.remembered && !!userId && s.passcodeUserId !== userId;
};

export async function setPasscode(userId: string, code: string) {
  await SecureStore.setItemAsync(PASSCODE_KEY, JSON.stringify({ userId, code } satisfies Saved));
  await SecureStore.deleteItemAsync(TRIES_KEY);
  // A new person on this phone starts without a fingerprint until they choose it.
  const keepBiometric = useAppLock.getState().passcodeUserId === userId;
  if (!keepBiometric) await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
  useAppLock.setState((s) => ({
    passcodeUserId: userId,
    tries: 0,
    biometric: keepBiometric && s.biometric,
  }));
}

/**
 * Checks a passcode. 'wrong' counts a try (kept across restarts, so closing the app does not
 * reset it); 'blocked' means too many: the caller signs out completely.
 */
export async function checkPasscode(code: string): Promise<'ok' | 'wrong' | 'blocked'> {
  const saved = await readSaved();
  if (saved && saved.code === code) {
    await SecureStore.deleteItemAsync(TRIES_KEY);
    useAppLock.setState({ tries: 0, locked: false });
    return 'ok';
  }
  const tries = useAppLock.getState().tries + 1;
  await SecureStore.setItemAsync(TRIES_KEY, String(tries));
  useAppLock.setState({ tries });
  return tries >= MAX_TRIES ? 'blocked' : 'wrong';
}

/** Forgets the passcode and fingerprint (full sign-out, too many wrong tries). */
export async function clearPasscode() {
  await Promise.all([
    SecureStore.deleteItemAsync(PASSCODE_KEY),
    SecureStore.deleteItemAsync(BIOMETRIC_KEY),
    SecureStore.deleteItemAsync(TRIES_KEY),
  ]).catch(() => undefined);
  useAppLock.setState({ passcodeUserId: null, biometric: false, locked: false, tries: 0 });
}

/** The phone has a fingerprint / face sensor with one set up. */
export async function biometricAvailable() {
  try {
    return (
      (await LocalAuthentication.hasHardwareAsync()) &&
      (await LocalAuthentication.isEnrolledAsync())
    );
  } catch {
    return false;
  }
}

export async function setLockAfter(ms: LockAfter) {
  await SecureStore.setItemAsync(LOCK_AFTER_KEY, String(ms));
  useAppLock.setState({ lockAfter: ms });
}

export async function setBiometric(on: boolean) {
  if (on) await SecureStore.setItemAsync(BIOMETRIC_KEY, '1');
  else await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
  useAppLock.setState({ biometric: on });
}

/** Shows the system fingerprint / face prompt. True when it matched. */
export async function askBiometric(promptMessage: string, cancelLabel: string) {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel,
      disableDeviceFallback: true,
    });
    if (result.success) {
      await SecureStore.deleteItemAsync(TRIES_KEY);
      useAppLock.setState({ tries: 0, locked: false });
    }
    return result.success;
  } catch {
    return false;
  }
}
