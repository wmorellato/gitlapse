// Human, translation-friendly relative time ("3 days ago", "yesterday", "last
// month"). Uses Intl.RelativeTimeFormat so wording and pluralization follow the
// viewer's locale and stay full-word (never "3d") per our UX-copy rules.
const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

const MIN = 60;
const HR = 60 * MIN;
const DAY = 24 * HR;
const WEEK = 7 * DAY;
const MONTH = 2629800; // average seconds per month (30.44 days)
const YEAR = 31557600; // average seconds per year (365.25 days)

export function formatRelative(when: Date, now: Date): string {
  const seconds = Math.round((when.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);

  if (abs < MIN) return rtf.format(seconds, "second");
  if (abs < HR) return rtf.format(Math.round(seconds / MIN), "minute");
  if (abs < DAY) return rtf.format(Math.round(seconds / HR), "hour");
  if (abs < WEEK) return rtf.format(Math.round(seconds / DAY), "day");
  if (abs < MONTH) return rtf.format(Math.round(seconds / WEEK), "week");
  if (abs < YEAR) return rtf.format(Math.round(seconds / MONTH), "month");
  return rtf.format(Math.round(seconds / YEAR), "year");
}
