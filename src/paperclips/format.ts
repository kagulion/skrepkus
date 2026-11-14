// Обычный пробел, а не неразрывный: группы разрядов переносятся, и число не выходит за узкую карточку.
const SEP = ' ';

// После дробного числа в русском языке ставится родительный падеж: «1,50 миллиона».
const SCALE_NAMES = [
  '',
  'тысячи',
  'миллиона',
  'миллиарда',
  'триллиона',
  'квадриллиона',
  'квинтиллиона',
  'секстиллиона',
  'септиллиона',
  'октиллиона',
  'нониллиона',
  'дециллиона',
  'ундециллиона',
  'дуодециллиона',
  'тредециллиона',
  'кваттуордециллиона',
  'квиндециллиона',
  'секседециллиона',
  'септендециллиона',
  'октодециллиона',
  'новемдециллиона',
  'вигинтиллиона',
];

/**
 * Число с пробелами между разрядами и запятой перед дробной частью.
 * Как в оригинале, дробная часть отбрасывается, а не округляется, и большие числа выводятся всеми цифрами.
 */
export function formatWithCommas(num: number, decimal = 0): string {
  let base = String(num);
  if (base.includes('e-')) base = num.toFixed(Math.max(decimal, 0));
  if (base.includes('e+')) {
    const [mantissa, exp] = base.split('e+');
    let exponent = Number(exp);
    let digits = mantissa;
    if (mantissa.includes('.')) {
      const [int, frac] = mantissa.split('.');
      exponent -= frac.length;
      digits = int + frac;
    }
    base = digits + '0'.repeat(Math.max(0, exponent));
  }
  const dot = base.indexOf('.');
  const int = dot >= 0 ? base.slice(0, dot) : base;
  const grouped = Math.abs(num) <= 999 ? int : int.replace(/(\d)(?=(\d{3})+(?!\d))/g, `$1${SEP}`);
  if (decimal === 0) return grouped;
  const frac = dot >= 0 ? base.slice(dot + 1, dot + 1 + decimal) : '';
  return `${grouped},${frac.padEnd(decimal, '0')}`;
}

/** Мантисса и название степени: «12,50 квадриллиона». */
export function scaleNumber(n: number, decimals: number): string {
  let k = 0;
  while (n >= 1000 && k < SCALE_NAMES.length - 1) {
    n /= 1000;
    k++;
  }
  return n.toFixed(decimals).replace('.', ',') + (k > 0 ? ` ${SCALE_NAMES[k]}` : '');
}

export function numberCruncher(n: number, decimals = 2): string {
  if (n < 1000) return n.toFixed(0);
  return scaleNumber(n, decimals);
}

/** До миллиона — цифрами, дальше — мантисса и название степени. */
export function spellf(n: number): string {
  if (!(n >= 0)) return String(n);
  if (n < 1e6) return formatWithCommas(Math.floor(n));
  return scaleNumber(n, 2);
}

/** Длительность в тиках (1/100 с). */
export function timeCruncher(ticks: number): string {
  const x = ticks / 100;
  const h = Math.floor(x / 3600);
  const m = Math.floor((x % 3600) / 60);
  const s = Math.floor(x % 60);
  return [h > 0 ? `${h} ч` : '', m > 0 ? `${m} мин` : '', s > 0 ? `${s} сек` : ''].filter(Boolean).join(' ');
}

export const decimalComma = (n: number, digits: number) => n.toFixed(digits).replace('.', ',');

/** Счётчик скрепок в финале: оригинал выводит фиксированные строки из 54 цифр. */
export const groupDigits = (digits: string) => digits.replace(/,/g, SEP);
