// Thai telephone numbers (dashes optional)
//   mobile      06/08/09 + 8 digits   e.g. 0812345678, 081-234-5678
//   Bangkok     02 + 7 digits         e.g. 021234567,  02-123-4567
//   provincial  03x-07x + 6 digits    e.g. 053123456,  053-123-456
exports.THAI_PHONE_REGEX =
  /^(0[689]\d{8}|0[689]\d-\d{3}-\d{4}|02\d{7}|02-\d{3}-\d{4}|0[3-7]\d{7}|0[3-7]\d-\d{3}-\d{3})$/;

exports.THAI_PHONE_MESSAGE =
  "Please add a valid Thai telephone number (e.g. 081-234-5678 or 02-123-4567)";

// 24-hour time of day, e.g. 08:00, 21:30
exports.TIME_HHMM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
