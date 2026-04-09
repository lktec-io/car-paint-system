export function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return 'TZS 0';
  const num = Number(amount);
  return 'TZS ' + num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatNumber(value, decimals = 2) {
  const num = parseFloat(value);
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}
