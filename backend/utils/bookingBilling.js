/** Standard hotel times and fee rate (25% of nightly rate). */
const STANDARD_CHECK_IN_HOUR = 14;
const STANDARD_CHECK_OUT_HOUR = 12;
const FEE_RATE = 0.25;

const nightsBetween = (checkIn, checkOut) => {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return 1;
  const hours = ms / (1000 * 60 * 60);
  return Math.max(1, Math.ceil(hours / 24));
};

const hoursBetween = (checkIn, checkOut) => {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return 0;
  return Math.round((ms / (1000 * 60 * 60)) * 10) / 10;
};

/**
 * Calculate base stay + early check-in / late check-out fees + promo discount.
 */
const calculateBilling = (checkIn, checkOut, roomPrice, discountPercent = 0) => {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const nights = nightsBetween(start, end);
  const hours = hoursBetween(start, end);
  const price = Number(roomPrice) || 0;
  const baseAmount = nights * price;

  const checkInMinutes = start.getHours() * 60 + start.getMinutes();
  const checkOutMinutes = end.getHours() * 60 + end.getMinutes();
  const earlyCheckInFee =
    checkInMinutes < STANDARD_CHECK_IN_HOUR * 60 ? Math.round(price * FEE_RATE) : 0;
  const lateCheckOutFee =
    checkOutMinutes > STANDARD_CHECK_OUT_HOUR * 60 ? Math.round(price * FEE_RATE) : 0;

  const subtotal = baseAmount + earlyCheckInFee + lateCheckOutFee;
  const discount = Math.min(100, Math.max(0, Number(discountPercent) || 0));
  const discountAmount = Math.round((subtotal * discount) / 100);
  const totalAmount = Math.max(0, subtotal - discountAmount);

  return {
    nights,
    hours,
    baseAmount,
    earlyCheckInFee,
    lateCheckOutFee,
    discountPercent: discount,
    discountAmount,
    totalAmount,
  };
};

const derivePaymentStatus = (totalAmount, amountPaid) => {
  const total = Number(totalAmount) || 0;
  const paid = Number(amountPaid) || 0;
  if (paid <= 0) return 'Pending';
  if (paid >= total) return 'Paid';
  return 'Partial';
};

module.exports = {
  STANDARD_CHECK_IN_HOUR,
  STANDARD_CHECK_OUT_HOUR,
  FEE_RATE,
  nightsBetween,
  hoursBetween,
  calculateBilling,
  derivePaymentStatus,
};
