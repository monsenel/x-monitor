function isPersianLang(): boolean {
  if (typeof document !== 'undefined') {
    return document.documentElement.lang === 'fa';
  }
  return false;
}

// Pure algorithmic Gregorian to Jalali converter (zero external ICU dependency)
function gregorianToJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  gy -= gy <= 1600 ? 621 : 1600;
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) -
    80 +
    gd +
    g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  jy += Math.floor((days - 1) / 365);
  if (days > 0) days = (days - 1) % 365;
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return [jy, jm, jd];
}

const JALALI_MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

export function toGregorianDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;

    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const month = d.toLocaleString('en-US', { month: 'short' });

    return `${month} ${d.getDate()}, ${d.getFullYear()} · ${hours}:${minutes}`;
  } catch {
    return isoString;
  }
}

export function toJalaliDate(isoString: string): string {
  if (!isPersianLang()) {
    return toGregorianDate(isoString);
  }
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;

    const [jy, jm, jd] = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return `${toPersianDigits(jd)} ${JALALI_MONTH_NAMES[jm - 1]} ${toPersianDigits(jy)}، ${toPersianDigits(hours)}:${toPersianDigits(minutes)}`;
  } catch {
    return isoString;
  }
}

export function toRelativeTimeFa(isoString: string): string {
  const fa = isPersianLang();
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 30) return fa ? 'همین الان' : 'Just now';
    if (diffSec < 60) return fa ? `${toPersianDigits(diffSec)} ثانیه پیش` : `${diffSec}s ago`;

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return fa ? `${toPersianDigits(diffMin)} دقیقه پیش` : `${diffMin}m ago`;

    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return fa ? `${toPersianDigits(diffHour)} ساعت پیش` : `${diffHour}h ago`;

    const diffDays = Math.floor(diffHour / 24);
    if (diffDays < 7) return fa ? `${toPersianDigits(diffDays)} روز پیش` : `${diffDays}d ago`;

    return fa ? toJalaliDate(isoString) : toGregorianDate(isoString);
  } catch {
    return isoString;
  }
}

export function toPersianDigits(num: number | string): string {
  if (!isPersianLang()) {
    return String(num);
  }
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(num).replace(/[0-9]/g, (w) => farsiDigits[+w]);
}

export function formatNumberFa(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return toPersianDigits(num);
}

