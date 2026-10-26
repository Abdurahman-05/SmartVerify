import { create } from 'zustand';

import { getFeatures, type Features } from '@/lib/extras';

interface FeaturesState extends Features {
  /** True once the server has answered (or failed) at least once for this sign-in. */
  loaded: boolean;
  load: () => Promise<void>;
  set: (features: Features) => void;
  reset: () => void;
}

const off: Features = { featureBuyList: false, featureMoneyOut: false };

/**
 * Which owner extras are on. Anything not known to be on is hidden: no tab, no button, no route.
 * Filled on app start and after sign-in; the owner's Extra features screen updates it at once.
 */
export const useFeatures = create<FeaturesState>((set) => ({
  ...off,
  loaded: false,
  load: async () => {
    try {
      set({ ...(await getFeatures()), loaded: true });
    } catch {
      // Offline or refused: keep what was known (nothing on a first start) and stop waiting.
      set({ loaded: true });
    }
  },
  set: (features) => set({ ...features, loaded: true }),
  reset: () => set({ ...off, loaded: false }),
}));
