// Every "day" in Tally is the user's local day, not UTC. A tap at 00:30 in
// Dhaka belongs to that date, not to yesterday — so each Expense carries a
// denormalized `localDate` ("YYYY-MM-DD") computed in the account's timezone
// at write time. Aggregations then group on a plain string and never do
// timezone math inside MongoDB.
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import isoWeek from 'dayjs/plugin/isoWeek.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);
dayjs.extend(customParseFormat);

export const DEFAULT_TIMEZONE = 'Asia/Dhaka';
export const DATE_FORMAT = 'YYYY-MM-DD';
export const MONTH_FORMAT = 'YYYY-MM';

export const isValidTimezone = (tz) => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const zone = (tz) => (tz && isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE);

/** The instant `date` as seen in `tz`. */
export const inZone = (date, tz) => dayjs(date ?? new Date()).tz(zone(tz));

/** "YYYY-MM-DD" for an instant, in the user's timezone. */
export const toLocalDate = (date, tz) => inZone(date, tz).format(DATE_FORMAT);

/** "YYYY-MM" for an instant, in the user's timezone. */
export const toLocalMonth = (date, tz) => inZone(date, tz).format(MONTH_FORMAT);

/** ISO week key, "2026-W31" — the bucket key for cached weekly insights. */
export const toWeekKey = (date, tz) => {
  const d = inZone(date, tz);
  return `${d.isoWeekYear()}-W${String(d.isoWeek()).padStart(2, '0')}`;
};

export const todayLocalDate = (tz) => toLocalDate(new Date(), tz);
export const currentLocalMonth = (tz) => toLocalMonth(new Date(), tz);

/** Inclusive list of "YYYY-MM-DD" between two local dates. */
export const localDateRange = (startDate, endDate) => {
  const out = [];
  let cursor = dayjs(startDate, DATE_FORMAT);
  const end = dayjs(endDate, DATE_FORMAT);
  while (cursor.isSame(end) || cursor.isBefore(end)) {
    out.push(cursor.format(DATE_FORMAT));
    cursor = cursor.add(1, 'day');
  }
  return out;
};

/** The N local dates ending today, oldest first — the 30-day trend x-axis. */
export const lastNLocalDates = (n, tz) => {
  const end = inZone(new Date(), tz);
  return Array.from({ length: n }, (_, i) =>
    end.subtract(n - 1 - i, 'day').format(DATE_FORMAT)
  );
};

/** First and last local date of a "YYYY-MM" month, plus its length. */
export const monthBounds = (monthKey) => {
  const start = dayjs(`${monthKey}-01`, DATE_FORMAT);
  const end = start.endOf('month');
  return {
    startDate: start.format(DATE_FORMAT),
    endDate: end.format(DATE_FORMAT),
    days: end.date(),
  };
};

/** Previous "YYYY-MM" — for the month-vs-last-month comparison. */
export const previousMonth = (monthKey) =>
  dayjs(`${monthKey}-01`, DATE_FORMAT).subtract(1, 'month').format(MONTH_FORMAT);

/** 1-based day of the month for a local date; drives "day 18 of 31" pacing. */
export const dayOfMonth = (localDate) => dayjs(localDate, DATE_FORMAT).date();

/** Monday=0 … Sunday=6, matching the dashboard heatmap's column order. */
export const weekdayIndex = (localDate) =>
  (dayjs(localDate, DATE_FORMAT).day() + 6) % 7;

export const addDays = (localDate, n) =>
  dayjs(localDate, DATE_FORMAT).add(n, 'day').format(DATE_FORMAT);

export const diffInDays = (fromLocalDate, toLocalDate_) =>
  dayjs(toLocalDate_, DATE_FORMAT).diff(dayjs(fromLocalDate, DATE_FORMAT), 'day');

/**
 * Start of a local date as a real instant — used when a query needs a Date
 * bound (e.g. recurring rules) rather than the string `localDate` path.
 */
export const startOfLocalDate = (localDate, tz) =>
  dayjs.tz(`${localDate} 00:00:00`, 'YYYY-MM-DD HH:mm:ss', zone(tz)).toDate();

export const endOfLocalDate = (localDate, tz) =>
  dayjs.tz(`${localDate} 23:59:59.999`, 'YYYY-MM-DD HH:mm:ss.SSS', zone(tz)).toDate();

export { dayjs };
