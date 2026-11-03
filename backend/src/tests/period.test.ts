import { describe, expect, it } from 'vitest';

import { dayRange } from '../shared/utils/period.js';

describe('dayRange', () => {
  it('is one Addis Ababa day: 21:00 UTC the evening before, for 24 hours', () => {
    expect(dayRange('2026-11-03')).toEqual({
      gte: new Date('2026-11-02T21:00:00.000Z'),
      lt: new Date('2026-11-03T21:00:00.000Z'),
    });
  });
});
