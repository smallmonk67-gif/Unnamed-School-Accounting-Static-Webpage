export function formatCurrency(amount: any, currencySymbol: string = '$'): string {
  const num = Number(amount) || 0;
  return `${currencySymbol}${num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}
