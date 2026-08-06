export const REG_NUMBER_PATTERN = /^[A-Z0-9]{4,12}$/;
export const PHONE_PATTERN = /^\d{10}$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateVehicle(fields: { make: string; model: string; regNumber: string }) {
  const errors: Record<string, string> = {};
  if (!fields.make.trim()) errors.make = "Make is required.";
  if (!fields.model.trim()) errors.model = "Model is required.";
  if (!REG_NUMBER_PATTERN.test(fields.regNumber.trim().toUpperCase())) {
    errors.regNumber = "Enter a valid registration number (letters and numbers only).";
  }
  return errors;
}

export function validateRidePricing(fields: { seats: string; price: string }) {
  const errors: Record<string, string> = {};
  const seatsNum = Number(fields.seats);
  const priceNum = Number(fields.price);
  if (!Number.isInteger(seatsNum) || seatsNum < 1 || seatsNum > 8) {
    errors.seats = "Seats must be a whole number between 1 and 8.";
  }
  if (!Number.isFinite(priceNum) || priceNum <= 0) {
    errors.price = "Price must be greater than 0.";
  }
  return errors;
}

export function validateEmergencyContact(fields: { name: string; phone: string }) {
  const errors: Record<string, string> = {};
  if (!fields.name.trim()) errors.name = "Name is required.";
  if (!PHONE_PATTERN.test(fields.phone.trim())) errors.phone = "Enter a valid 10-digit phone number.";
  return errors;
}
