const DEFAULT_TAX = 0.1;
const DEFAULT_SERVICE = 0.05;

const lineSubtotal = (items) =>
  (items || []).reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);

const effectivePrice = (menu, at = new Date()) => {
  if (
    menu.happyHourPrice != null &&
    menu.happyHourStart != null &&
    menu.happyHourEnd != null
  ) {
    const h = at.getHours();
    const start = menu.happyHourStart;
    const end = menu.happyHourEnd;
    const inWindow = start <= end ? h >= start && h < end : h >= start || h < end;
    if (inWindow) return Number(menu.happyHourPrice);
  }
  return Number(menu.price);
};

const estimatePrep = (items, menuMap = {}) => {
  let maxPrep = 0;
  for (const line of items || []) {
    const menu = line.menuItem && menuMap[String(line.menuItem)];
    const prep = menu?.preparationTime ?? 15;
    maxPrep = Math.max(maxPrep, prep);
  }
  return maxPrep;
};

const calculateOrderTotals = ({
  items,
  taxRate = DEFAULT_TAX,
  serviceChargeRate = DEFAULT_SERVICE,
  discountPercent = 0,
}) => {
  const subtotal = lineSubtotal(items);
  const taxAmount = Math.round(subtotal * Number(taxRate) * 100) / 100;
  const serviceCharge = Math.round(subtotal * Number(serviceChargeRate) * 100) / 100;
  const beforeDiscount = subtotal + taxAmount + serviceCharge;
  const discount = Math.min(100, Math.max(0, Number(discountPercent) || 0));
  const discountAmount = Math.round((beforeDiscount * discount) / 100);
  const totalAmount = Math.max(0, Math.round((beforeDiscount - discountAmount) * 100) / 100);

  return {
    subtotal,
    taxRate: Number(taxRate),
    taxAmount,
    serviceChargeRate: Number(serviceChargeRate),
    serviceCharge,
    discountPercent: discount,
    discountAmount,
    totalAmount,
  };
};

module.exports = {
  DEFAULT_TAX,
  DEFAULT_SERVICE,
  lineSubtotal,
  effectivePrice,
  estimatePrep,
  calculateOrderTotals,
};
