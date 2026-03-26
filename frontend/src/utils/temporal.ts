type Cadence = "annual" | "monthly" | "daily" | "hourly" | "irregular";

const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;
const MS_MONTH = 28 * MS_DAY;
const MS_YEAR = 365 * MS_DAY;

function classifyInterval(ms: number): Cadence | null {
  if (ms >= MS_YEAR * 0.9 && ms <= MS_YEAR * 1.1) return "annual";
  if (ms >= MS_MONTH * 0.9 && ms <= MS_MONTH * 1.5) return "monthly";
  if (ms >= MS_DAY * 0.9 && ms <= MS_DAY * 1.1) return "daily";
  if (ms >= MS_HOUR * 0.9 && ms <= MS_HOUR * 1.1) return "hourly";
  return null;
}

export function detectCadence(datetimes: string[]): Cadence {
  if (datetimes.length < 2) return "irregular";

  const sorted = [...datetimes].sort();
  const diffs: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    diffs.push(
      new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()
    );
  }

  const median = diffs.sort((a, b) => a - b)[Math.floor(diffs.length / 2)];
  return classifyInterval(median) ?? "irregular";
}

function detectBaseCadence(datetimes: string[]): Cadence {
  if (datetimes.length < 2) return "irregular";

  const sorted = [...datetimes].sort();
  const diffs: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    diffs.push(
      new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()
    );
  }

  const minDiff = Math.min(...diffs);

  // Try dividing the minimum diff by small integers to find the base cadence unit
  for (let divisor = 1; divisor <= 12; divisor++) {
    const candidate = minDiff / divisor;
    const base = classifyInterval(candidate);
    if (!base) continue;

    // Verify all diffs are approximate multiples of this candidate
    const allMatch = diffs.every((diff) => {
      const ratio = diff / candidate;
      return Math.abs(ratio - Math.round(ratio)) < 0.15;
    });
    if (allMatch) return base;
  }

  return "irregular";
}

function addCalendarStep(date: Date, cadence: Cadence): Date {
  const d = new Date(date);
  switch (cadence) {
    case "annual":
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      break;
    case "monthly":
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    case "daily":
      d.setUTCDate(d.getUTCDate() + 1);
      break;
    case "hourly":
      d.setUTCHours(d.getUTCHours() + 1);
      break;
    default:
      break;
  }
  return d;
}

export function findGaps(datetimes: string[]): string[] {
  const cadence = detectBaseCadence(datetimes);
  if (cadence === "irregular") return [];

  const sorted = [...datetimes].sort();
  const gaps: string[] = [];
  const existing = new Set(sorted);

  for (let i = 1; i < sorted.length; i++) {
    let expected = addCalendarStep(new Date(sorted[i - 1]), cadence);
    const currTime = new Date(sorted[i]).getTime();

    while (expected.getTime() < currTime - MS_HOUR) {
      const iso = expected.toISOString().replace(".000Z", "Z");
      if (!existing.has(iso)) {
        gaps.push(iso);
      }
      expected = addCalendarStep(expected, cadence);
    }
  }

  return gaps;
}

export function isSubDaily(datetimes: string[]): boolean {
  if (datetimes.length < 2) return false;
  const sorted = [...datetimes].sort();
  const diff = new Date(sorted[1]).getTime() - new Date(sorted[0]).getTime();
  return diff < MS_DAY;
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatTimestepLabel(
  datetime: string,
  cadence: Cadence
): string {
  const d = new Date(datetime);
  switch (cadence) {
    case "annual":
      return String(d.getUTCFullYear());
    case "monthly":
      return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    case "daily":
      return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
    case "hourly": {
      const hour = d.getUTCHours().toString().padStart(2, "0");
      return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()} · ${hour}:00 UTC`;
    }
    default:
      return d.toISOString().slice(0, 10);
  }
}

export function formatDateRange(datetimes: string[], cadence: Cadence): string {
  if (datetimes.length === 0) return "";
  const sorted = [...datetimes].sort();
  const start = formatTimestepLabel(sorted[0], cadence);
  const end = formatTimestepLabel(sorted[sorted.length - 1], cadence);
  return `${start} – ${end}`;
}
