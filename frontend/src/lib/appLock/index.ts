import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

/**
 * App lock, like a bank app: after the first full sign-in the person makes a 4-digit passcode
 * (and may add a fingerprint). Opening the app or coming back after a while then only asks for
 * it, offline: it is checked on the phone. Each person who signs in on this phone keeps their
 * own passcode (switching accounts does not erase the others'). Passcodes live in the phone's
 * secure storage (encrypted by the system), never on the server.
 */
const PASSCODES_KEY = 'smartverify.passcodes';
/** Older single-passcode storage, moved into PASSCODES_KEY once. */
const OLD_PASSCODE_KEY = 'smartverify.passcode';
const BIOMETRIC_KEY = 'smartverify.biometricUsers';
const TRIES_KEY = 'smartverify.passcodeTries';
const LOCK_AFTER_KEY = 'smartverify.lockAfter';

export const PASSCODE_LENGTH = 4;
/** After this many wrong passcodes the phone forgets the sign-in: phone + PIN again. */
export const MAX_TRIES = 5;
/**
 * Choices for "Ask for passcode after" (ms in the background). No "every time": opening the camera
 * or gallery (scanning or uploading a receipt) also leaves the app for a moment.
 */
export const LOCK_AFTER_CHOICES = [
  60_000,
  3 * 60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
] as const;
export type LockAfter = (typeof LOCK_AFTER_CHOICES)[number];
const DEFAULT_LOCK_AFTER: LockAfter = 3 * 60_000;

/** userId → passcode */
type Passcodes = Record<string, string>;

interface AppLockState {
  /** Read from storage (at start). */
  loaded: boolean;
  /** A sign-in is remembered on this phone (only then is there a lock). */
  remembered: boolean;
  /** People who have a passcode on this phone. */
  passcodeUsers: string[];
  /** People who open the app with their fingerprint. */
  biometricUsers: string[];
  /** Back from the background after this long: locked again. */
  lockAfter: LockAfter;
  locked: boolean;
  tries: number;
  setRemembered: (remembered: boolean) => void;
  /** Locks when this person has a passcode on a remembered phone. */
  lock: (userId: string | undefined) => void;
  unlock: () => void;
}

export const useAppLock = create<AppLockState>((set) => ({
  loaded: false,
  remembered: false,
  passcodeUsers: [],
  biometricUsers: [],
  lockAfter: DEFAULT_LOCK_AFTER,
  locked: false,
  tries: 0,
  setRemembered: (remembered) => set({ remembered }),
  lock: (userId) =>
    set((s) => ({ locked: s.remembered && !!userId && s.passcodeUsers.includes(userId) })),
  unlock: () => set({ locked: false }),
}));

const parse = <T>(raw: string | null, fallback: T): T => {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

async function readPasscodes(): Promise<Passcodes> {
  const all = parse<Passcodes>(await SecureStore.getItemAsync(PASSCODES_KEY).catch(() => null), {});
  // The earlier version kept one passcode: keep it for its owner.
  const old = parse<{ userId?: string; code?: string } | null>(
    await SecureStore.getItemAsync(OLD_PASSCODE_KEY).catch(() => null),
    null
  );
  if (old?.userId && old.code && !all[old.userId]) {
    all[old.userId] = old.code;
    await SecureStore.setItemAsync(PASSCODES_KEY, JSON.stringify(all));
  }
  if (old) await SecureStore.deleteItemAsync(OLD_PASSCODE_KEY).catch(() => undefined);
  return all;
}

const savePasscodes = (all: Passcodes) =>
  SecureStore.setItemAsync(PASSCODES_KEY, JSON.stringify(all));
const saveBiometricUsers = (users: string[]) =>
  SecureStore.setItemAsync(BIOMETRIC_KEY, JSON.stringify(users));

/** Reads the lock settings once, at start. */
export async function loadAppLock() {
  const [passcodes, biometric, tries, lockAfter] = await Promise.all([
    readPasscodes(),
    SecureStore.getItemAsync(BIOMETRIC_KEY).catch(() => null),
    SecureStore.getItemAsync(TRIES_KEY).catch(() => null),
    SecureStore.getItemAsync(LOCK_AFTER_KEY).catch(() => null),
  ]);
  const users = Object.keys(passcodes);
  useAppLock.setState({
    loaded: true,
    lockAfter: LOCK_AFTER_CHOICES.find((c) => String(c) === lockAfter) ?? DEFAULT_LOCK_AFTER,
    passcodeUsers: users,
    biometricUsers: parse<string[]>(biometric, []).filter((u) => users.includes(u)),
    tries: Number(tries) || 0,
  });
}

/** The signed-in person must make a passcode first (a remembered sign-in without one). */
export const needsPasscode = (userId: string | undefined) => {
  const s = useAppLock.getState();
  return s.remembered && !!userId && !s.passcodeUsers.includes(userId);
};

export async function setPasscode(userId: string, code: string) {
  const all = await readPasscodes();
  all[userId] = code;
  await savePasscodes(all);
  await SecureStore.deleteItemAsync(TRIES_KEY);
  useAppLock.setState({ passcodeUsers: Object.keys(all), tries: 0 });
}

/**
 * Checks this person's passcode. 'wrong' counts a try (kept across restarts, so closing the app
 * does not reset it); 'blocked' means too many: the caller signs out completely.
 */
export async function checkPasscode(
  userId: string,
  code: string
): Promise<'ok' | 'wrong' | 'blocked'> {
  const all = await readPasscodes();
  if (all[userId] === code) {
    await SecureStore.deleteItemAsync(TRIES_KEY);
    useAppLock.setState({ tries: 0, locked: false });
    return 'ok';
  }
  const tries = useAppLock.getState().tries + 1;
  await SecureStore.setItemAsync(TRIES_KEY, String(tries));
  useAppLock.setState({ tries });
  return tries >= MAX_TRIES ? 'blocked' : 'wrong';
}

/** Forgets one person's passcode and fingerprint (after too many wrong tries). */
export async function clearPasscode(userId: string) {
  const all = await readPasscodes();
  delete all[userId];
  const biometricUsers = useAppLock.getState().biometricUsers.filter((u) => u !== userId);
  await Promise.all([
    savePasscodes(all),
    saveBiometricUsers(biometricUsers),
    SecureStore.deleteItemAsync(TRIES_KEY),
  ]).catch(() => undefined);
  useAppLock.setState({
    passcodeUsers: Object.keys(all),
    biometricUsers,
    locked: false,
    tries: 0,
  });
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

export async function setBiometric(userId: string, on: boolean) {
  const others = useAppLock.getState().biometricUsers.filter((u) => u !== userId);
  const biometricUsers = on ? [...others, userId] : others;
  await saveBiometricUsers(biometricUsers);
  useAppLock.setState({ biometricUsers });
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
