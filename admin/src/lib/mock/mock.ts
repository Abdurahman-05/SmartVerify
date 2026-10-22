export const mockDelay = (ms = 1200) => new Promise<void>((resolve) => setTimeout(resolve, ms));
