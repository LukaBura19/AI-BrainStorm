/** Srpski oblik imenice uz broj: 1 snimak, 2 snimka, 5 snimaka, 11–14 snimaka, 21 snimak. */
export function plural(count, one, few, many) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (last === 1 && lastTwo !== 11) return one;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
}
