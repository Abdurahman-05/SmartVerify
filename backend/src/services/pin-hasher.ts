import { hash, verify } from '@node-rs/argon2';

// Algorithm.Argon2id from @node-rs/argon2 (a const enum, which verbatimModuleSyntax cannot import).
const ARGON2ID = 2;

// Argon2id with OWASP-recommended minimums (19 MiB memory, 2 iterations, 1 lane).
const options = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export const hashPin = (pin: string) => hash(pin, options);

export async function verifyPin(pinHash: string, pin: string): Promise<boolean> {
  try {
    return await verify(pinHash, pin);
  } catch {
    return false;
  }
}

/** Hash checked when the phone is unknown, so response time does not reveal which phones exist. */
let dummyHash: Promise<string> | null = null;
export async function verifyAgainstDummy(pin: string): Promise<false> {
  dummyHash ??= hash('0000000', options);
  await verifyPin(await dummyHash, pin);
  return false;
}
