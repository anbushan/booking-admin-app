// Small validation helpers, applied at the top of route handlers before
// touching the database. Returns a list of field-level error strings;
// an empty array means the payload is valid.

export function isPhone(value) {
  return typeof value === "string" && /^\d{10}$/.test(value);
}

export function isNonEmptyString(value, maxLen = 500) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLen;
}

export function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function isPositiveNumber(value) {
  return isNumber(value) && value > 0;
}

export function isPositiveInt(value) {
  return Number.isInteger(value) && value > 0;
}

export function isInRange(value, min, max) {
  return isNumber(value) && value >= min && value <= max;
}

export function isLat(value) {
  return isNumber(value) && value >= -90 && value <= 90;
}

export function isLng(value) {
  return isNumber(value) && value >= -180 && value <= 180;
}

export function isFutureDate(value) {
  const d = new Date(value);
  return !isNaN(d.getTime()) && d.getTime() > Date.now();
}

export function isValidDate(value) {
  const d = new Date(value);
  return !isNaN(d.getTime());
}

export function isOneOf(value, options) {
  return options.includes(value);
}

export function isEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Runs a set of { field, check, message } rules against a payload and
// returns the collected error messages. Middleware-free by design — call
// this at the top of a handler and return 400 with `errors` if non-empty.
export function validate(payload, rules) {
  const errors = [];
  for (const rule of rules) {
    const value = payload[rule.field];
    if (rule.optional && (value === undefined || value === null)) continue;
    if (!rule.check(value)) errors.push(rule.message);
  }
  return errors;
}
