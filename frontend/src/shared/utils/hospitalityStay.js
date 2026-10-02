/**
 * Hospitality Stay Cycle Utility (11:00 AM - 11:00 AM Standard)
 *
 * Implements the standard hospitality industry billing cycle:
 * - Standard Check-In: 11:00 AM / 12:00 PM
 * - Standard Check-Out: 11:00 AM
 * - Default Grace Period: 60 minutes (Cutoff: 12:00 PM)
 * - Departures after cutoff automatically bill an additional night / overstay.
 */

export const calculateHospitalityStay = ({
  checkinDateStr,
  checkinTimeStr = "11:00",
  checkoutDateStr,
  checkoutTimeStr = "11:00",
  hotelStandardCheckout = "11:00",
  graceMinutes = 60,
}) => {
  if (!checkinDateStr || !checkoutDateStr) {
    return {
      nights: 1,
      days: 2,
      stay_label: "2 Days / 1 Night",
      is_late_checkout: false,
      base_nights: 1,
    };
  }

  const checkin = new Date(`${checkinDateStr}T${checkinTimeStr || "11:00"}:00`);
  const checkout = new Date(`${checkoutDateStr}T${checkoutTimeStr || "11:00"}:00`);

  if (checkout <= checkin) {
    return {
      nights: 1,
      days: 2,
      stay_label: "2 Days / 1 Night",
      is_late_checkout: false,
      base_nights: 1,
    };
  }

  // Base calendar night count (midnight-to-midnight equivalent)
  const startDay = new Date(checkinDateStr);
  const endDay = new Date(checkoutDateStr);
  let baseNights = Math.max(1, Math.round((endDay - startDay) / (1000 * 60 * 60 * 24)));

  // Parse property cutoff threshold (e.g. 11:00 AM checkout + 60 min grace = 12:00 PM cutoff)
  const cutoff = new Date(`${checkoutDateStr}T${hotelStandardCheckout || "11:00"}:00`);
  cutoff.setMinutes(cutoff.getMinutes() + (Number(graceMinutes) || 60));

  let isLateCheckout = false;
  let billableNights = baseNights;

  // Overstay check: departures after grace cutoff incur an additional night charge
  if (checkout > cutoff) {
    billableNights += 1;
    isLateCheckout = true;
  }

  const billableDays = billableNights + 1;

  return {
    nights: billableNights,
    days: billableDays,
    stay_label: `${billableDays} Days / ${billableNights} Night${billableNights > 1 ? "s" : ""}`,
    is_late_checkout: isLateCheckout,
    base_nights: baseNights,
  };
};

export const formatStayLabel = (checkinDate, checkoutDate, checkinTime = "11:00", checkoutTime = "11:00") => {
  const stay = calculateHospitalityStay({
    checkinDateStr: checkinDate,
    checkinTimeStr: checkinTime,
    checkoutDateStr: checkoutDate,
    checkoutTimeStr: checkoutTime,
  });
  return stay.stay_label;
};
