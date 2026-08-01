// Money is stored and moved around as integers in the smallest currency unit
// ("minor units" — poisha for BDT, cents for USD). Floats never touch an
// amount: every field on a model is `*Minor` and every arithmetic step below
// stays in integer space. Formatting to a display string is the only place a
// decimal appears, and it happens at the edge.

export const CURRENCIES = {
  BDT: { code: 'BDT', symbol: '৳', minorDigits: 2, locale: 'en-IN' },
  INR: { code: 'INR', symbol: '₹', minorDigits: 2, locale: 'en-IN' },
  USD: { code: 'USD', symbol: '$', minorDigits: 2, locale: 'en-US' },
  EUR: { code: 'EUR', symbol: '€', minorDigits: 2, locale: 'en-IE' },
  GBP: { code: 'GBP', symbol: '£', minorDigits: 2, locale: 'en-GB' },
  PKR: { code: 'PKR', symbol: '₨', minorDigits: 2, locale: 'en-PK' },
  LKR: { code: 'LKR', symbol: 'Rs', minorDigits: 2, locale: 'en-LK' },
  NPR: { code: 'NPR', symbol: 'रू', minorDigits: 2, locale: 'en-NP' },
};

export const DEFAULT_CURRENCY = 'BDT';

export const getCurrency = (code) => CURRENCIES[code] ?? CURRENCIES[DEFAULT_CURRENCY];

/** Minor units per major unit, e.g. 100 poisha to the taka. */
export const minorFactor = (code) => 10 ** getCurrency(code).minorDigits;

/**
 * Major → minor. Accepts what a human or a model might produce ("1,250.50",
 * 250, "৳40") and lands on an integer. Returns null when there is no number.
 */
export const toMinor = (value, code = DEFAULT_CURRENCY) => {
  if (value === null || value === undefined || value === '') return null;

  const numeric =
    typeof value === 'number'
      ? value
      : Number(String(value).replace(/[^0-9.-]/g, ''));

  if (!Number.isFinite(numeric)) return null;

  // Round in minor space so 0.1 + 0.2 style drift can't survive the trip.
  return Math.round(numeric * minorFactor(code));
};

/** Minor → major, as a Number. For display and for the AI prompts only. */
export const toMajor = (minor, code = DEFAULT_CURRENCY) => {
  if (!Number.isFinite(minor)) return 0;
  return minor / minorFactor(code);
};

/**
 * Display string, matching the design's typography: grouped digits, no
 * trailing ".00" on whole amounts (the Tap Pad shows "৳442", not "৳442.00").
 */
export const formatMoney = (minor, code = DEFAULT_CURRENCY, { withSymbol = true } = {}) => {
  const currency = getCurrency(code);
  const major = toMajor(minor ?? 0, code);
  const hasFraction = (minor ?? 0) % minorFactor(code) !== 0;

  const body = new Intl.NumberFormat(currency.locale, {
    minimumFractionDigits: hasFraction ? currency.minorDigits : 0,
    maximumFractionDigits: currency.minorDigits,
  }).format(major);

  return withSymbol ? `${currency.symbol}${body}` : body;
};

/** Guard for anything crossing the API boundary into an amount field. */
export const isValidMinor = (value) =>
  Number.isInteger(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;

/**
 * Split a total across n parts without losing or inventing a single minor
 * unit — used when a scanned receipt total has to be reconciled against its
 * line items. The remainder is spread one unit at a time across the first
 * parts, so the parts always sum back to `totalMinor` exactly.
 */
export const splitMinor = (totalMinor, parts) => {
  if (parts <= 0) return [];
  const base = Math.floor(totalMinor / parts);
  const remainder = totalMinor - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0));
};

/** Percentage of `limit` used by `spent`, as a 0..n float. Safe at limit 0. */
export const ratioOf = (spentMinor, limitMinor) => {
  if (!limitMinor || limitMinor <= 0) return 0;
  return spentMinor / limitMinor;
};
