/**
 * Districts whose Home Access Center address is known (mostly Texas; others as users report them).
 *
 * Every URL here was checked by loading `<url>/HomeAccess/Account/LogOn` and confirming it
 * serves the HAC login form (October 2026). Districts not listed can still sign in by
 * typing their address ("My district isn't listed" in the picker). To add one, verify the
 * login page loads first, then add it here in alphabetical order.
 */

export interface District {
  name: string;
  /** City or area, for search and the subtitle. */
  city: string;
  /** HAC origin, no path. */
  url: string;
}

export const DISTRICTS: District[] = [
  { name: 'Aldine ISD', city: 'Houston', url: 'https://hac.aldineisd.org' },
  { name: 'Brownsville ISD', city: 'Brownsville', url: 'https://hac.bisd.us' },
  { name: 'College Station ISD', city: 'College Station', url: 'https://hac.csisd.org' },
  { name: 'Conroe ISD', city: 'Conroe', url: 'https://hac.conroeisd.net' },
  { name: 'Coppell ISD', city: 'Coppell', url: 'https://hac.coppellisd.com' },
  { name: 'Corpus Christi ISD', city: 'Corpus Christi', url: 'https://hac.ccisd.us' },
  { name: 'Cypress-Fairbanks ISD', city: 'Cypress / Houston', url: 'https://home-access.cfisd.net' },
  { name: 'Frisco ISD', city: 'Frisco', url: 'https://hac.friscoisd.org' },
  { name: 'Humble ISD', city: 'Humble / Kingwood', url: 'https://homeaccess.humbleisd.net' },
  { name: 'Hurst-Euless-Bedford ISD', city: 'Bedford', url: 'https://homeaccess.hebisd.edu' },
  { name: 'Irving ISD', city: 'Irving', url: 'https://homeaccess.irvingisd.net' },
  { name: 'Katy ISD', city: 'Katy', url: 'https://homeaccess.katyisd.org' },
  { name: 'McKinney ISD', city: 'McKinney', url: 'https://hac.mckinneyisd.net' },
  { name: 'Midway ISD', city: 'Woodway / Waco', url: 'https://hac.midwayisd.org' },
  { name: 'Northside ISD', city: 'San Antonio', url: 'https://hac.nisd.net' },
  { name: 'Northwest ISD', city: 'Justin / Fort Worth', url: 'https://hac.nisdtx.org' },
  { name: 'Plainfield CCSD 202', city: 'Plainfield, IL', url: 'https://esp-has-1.psd202.org' },
  { name: 'Round Rock ISD', city: 'Round Rock', url: 'https://hac.roundrockisd.org' },
  { name: 'Ysleta ISD', city: 'El Paso', url: 'https://hac2.yisd.net' },
];

/** "Cypress-Fairbanks ISD" → "cfisd", so people can search the way they talk. */
const initials = (name: string) =>
  name
    .split(/[\s-]+/)
    .map((w) => (w === 'ISD' || w === 'CISD' ? w : w[0]))
    .join('')
    .toLowerCase();

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Case- and punctuation-insensitive search over name, city, abbreviation and host.
 * An empty query returns every district.
 */
export function searchDistricts(query: string, districts: District[] = DISTRICTS): District[] {
  const q = normalize(query);
  if (!q) return districts;
  return districts.filter((d) =>
    [d.name, d.city, initials(d.name), new URL(d.url).host].some((field) => normalize(field).includes(q)),
  );
}

/** The listed district for a HAC origin, if any (used to label saved accounts). */
export const districtForUrl = (url: string): District | undefined => DISTRICTS.find((d) => d.url === url);
