import { normalizeBaseUrl } from '@/hac/endpoints';

import { DISTRICTS, districtForUrl, searchDistricts } from '../districts';

describe('district list', () => {
  it('is alphabetical with unique, normalized HAC origins', () => {
    const names = DISTRICTS.map((d) => d.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(new Set(DISTRICTS.map((d) => d.url)).size).toBe(DISTRICTS.length);
    for (const d of DISTRICTS) expect(normalizeBaseUrl(d.url)).toBe(d.url);
  });

  it('searches by name, city, abbreviation and host', () => {
    expect(searchDistricts('').length).toBe(DISTRICTS.length);
    expect(searchDistricts('frisco').map((d) => d.name)).toEqual(['Frisco ISD']);
    expect(searchDistricts('CFISD').map((d) => d.name)).toEqual(['Cypress-Fairbanks ISD']);
    expect(searchDistricts('san antonio').map((d) => d.name)).toEqual(['Northside ISD']);
    expect(searchDistricts('katyisd.org').map((d) => d.name)).toEqual(['Katy ISD']);
    expect(searchDistricts('psd202').map((d) => d.name)).toEqual(['Plainfield CCSD 202']);
    expect(searchDistricts('plainfield').map((d) => d.name)).toEqual(['Plainfield CCSD 202']);
    expect(searchDistricts('zzz')).toEqual([]);
  });

  it('finds the district for a saved address', () => {
    expect(districtForUrl('https://hac.friscoisd.org')?.name).toBe('Frisco ISD');
    expect(districtForUrl('https://hac.example.org')).toBeUndefined();
  });
});
