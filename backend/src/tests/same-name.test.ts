import { describe, expect, it } from 'vitest';

import { sameName } from '../modules/verification/compare.js';

describe('receiver name on a receipt against the saved holder name', () => {
  it('accepts the same name with small spelling differences', () => {
    const same: [string, string][] = [
      ['ABDURAHMAN ELIYAS MUHAMED', 'Abdurahman Eliyas'],
      ['Abdulrahman Elias Muhammed', 'Abdurahman Eliyas'],
      ['MOHAMED ALI', 'Mohammed Ali'],
      ['Muhammed Ali Hassen', 'Mohammed Ali'],
      ['Abdu Rahman Eliyas', 'Abdurahman Eliyas'],
      ['Abdurahman Eliyas', 'Abdu Rahman Eliyas'],
      ['ABEBE COFFEE BEKELE', 'Abebe Coffee Bekele'],
      ['Salahadin Nuredin Husen', 'Salahaddin Nuredin Hussen'],
      ['Abdurehman Eliass', 'Abdurahman Eliyas'],
      ['Hussien Ahmed', 'Husein Ahmed'],
      ['Tigist Gebremedhin', 'Tigist Gebremedihn'],
      ['Abdurahman Eli', 'Abdurahman Eliyas'],
      ['Abdurahmn Eliyas Muhamed', 'Abdurahman Eliyas'],
    ];
    for (const [receipt, saved] of same)
      expect(sameName(receipt, saved), `${receipt} / ${saved}`).toBe(true);
  });

  it('still refuses a different person', () => {
    const different: [string, string][] = [
      ['Kebede Alemu', 'Abebe Bekele'],
      ['Abebe Kebede', 'Abebe Bekele Tadesse'],
      ['Almaz Tesfaye', 'Alemu Tesfaye'],
      ['Ali Bekele', 'Abel Bekele'],
      ['Mohammed', 'Mohammed Ali'],
      ['', 'Abebe Bekele'],
    ];
    for (const [receipt, saved] of different)
      expect(sameName(receipt, saved), `${receipt} / ${saved}`).toBe(false);
  });

  it('one saved word alone is too weak to count unless it is exactly the name', () => {
    expect(sameName('Abebe', 'Abebe')).toBe(true);
    expect(sameName('Abebe Bekele', 'Abebe')).toBe(false);
  });
});
