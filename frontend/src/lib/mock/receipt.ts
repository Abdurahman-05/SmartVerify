import { mockDelay } from './mock';

/**
 * FAKE receipt reading (OCR) until the real reader exists. Like a real reader it may miss
 * something: it finds the first field and leaves the rest for the user to type.
 */
export async function readReceipt(
  fields: { key: string; sample: string }[]
): Promise<Record<string, string>> {
  await mockDelay(1800);
  const [first] = fields;
  return first ? { [first.key]: first.sample } : {};
}
