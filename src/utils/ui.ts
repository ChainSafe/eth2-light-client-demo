export function truncateAmountWithCommas(amount: string): string {
  const displayAmount = amount.match(/^-?\d+(?:\.\d{0,2})?/);
  if (displayAmount !== null && displayAmount.length > 0) {
    return displayAmount[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  return "NA";
}
