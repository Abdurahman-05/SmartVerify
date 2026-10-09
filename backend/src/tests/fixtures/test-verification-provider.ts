/**
 * TEST-ONLY verification provider. Never registered by the production app (src/server.ts passes none).
 * It returns whatever the test scripts, so tests can exercise the service rules without a bank.
 */
import type {
  PaymentEvidence,
  ProviderLookup,
  VerificationProvider,
} from '../../modules/verification/verification.types.js';

export class ScriptedTestProvider implements VerificationProvider {
  readonly id = 'test-scripted';
  next: ProviderLookup = { outcome: 'unavailable' };

  canHandle(evidence: PaymentEvidence) {
    return evidence.raw.startsWith('TEST:');
  }

  async lookup(): Promise<ProviderLookup> {
    return this.next;
  }
}
