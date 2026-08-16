import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { razorpay } from "../lib/razorpay.js";
import { getAppConfig } from "../lib/appConfig.js";
import { verifyRC, verifyLicense, initiateAadhaarOtp, verifyAadhaarOtp, isRcVerified, isLicenseVerified } from "../lib/eko.js";
import { confirmDriverVerificationPayment, confirmVehicleVerificationPayment, confirmPassengerVerificationPayment } from "../lib/verification.js";
import { validate, isNonEmptyString, isValidDate, isFutureDate } from "../lib/validate.js";
import { getIO } from "../lib/socket.js";

const router = Router();

// Loose but real format check — Indian DL numbers vary by state (e.g.
// "TN0120230012345", "MH12 20110012345") so this isn't a strict pattern
// match, just alphanumeric-with-separators of a plausible length.
const DL_NUMBER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\-/ ]{5,19}$/;

// Aadhaar numbers are exactly 12 digits — a genuinely fixed format,
// unlike DL/RC's state-by-state variation, so this one's a strict
// pattern rather than a loose one. Spaces allowed on input (how it's
// usually written/read aloud, "1234 5678 9012") and stripped before
// validating or sending to Eko.
const AADHAAR_PATTERN = /^\d{12}$/;

function isValidDob(value) {
  if (!isNonEmptyString(value, 30) || !isValidDate(value) || isFutureDate(value)) return false;
  const ageYears = (Date.now() - new Date(value).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return ageYears >= 18 && ageYears <= 100;
}

// Shapes the fields worth showing a driver for review out of Eko's much
// larger raw response — same subset regardless of whether it just came
// back from a live check or (later) a re-display of an already-PENDING
// row, so the preview UI only needs one shape to render.
function buildLicensePreview(raw, dlNumber, wouldPass) {
  const d = raw?.data || {};
  const details = d.details_of_driving_licence || {};
  const validity = d.dl_validity || {};
  const covs = Array.isArray(d.cov_details) ? d.cov_details.map((c) => c.cov).filter(Boolean) : [];
  return {
    dlNumber,
    name: details.name ?? null,
    status: d.status ?? null,
    dob: d.dob ?? null,
    address: details.address ?? null,
    issueDate: details.issue_date ?? null,
    nonTransportValidUpto: validity.non_transport_valid_upto ?? null,
    transportValidUpto: validity.transport_valid_upto ?? null,
    vehicleClasses: covs,
    wouldPass,
  };
}

function buildRcPreview(raw, regNumber, wouldPass) {
  const d = raw?.data || {};
  return {
    regNumber,
    owner: d.owner ?? null,
    status: d.rc_status ?? null,
    expiryDate: d.rc_expiry_date ?? null,
    registrationDate: d.registration_date ?? null,
    vehicleClass: d.vehicle_class ?? null,
    makerModel: d.maker_model ?? null,
    fuelType: d.fuel_type ?? null,
    chassisNumber: d.chassis_number ?? null,
    engineNumber: d.engine_number ?? null,
    insuranceUpto: d.vehicle_insurance_upto ?? null,
    insuranceCompany: d.vehicle_insurance_company_name ?? null,
    puccUpto: d.pucc_upto ?? null,
    wouldPass,
  };
}

function buildAadhaarPreview(raw, aadhaarNumber, wouldPass) {
  const d = raw?.data || {};
  return {
    aadhaarNumber: d.aadhaar_number ?? aadhaarNumber,
    name: d.name ?? null,
    status: d.status ?? null,
    dob: d.dob ?? null,
    gender: d.gender ?? null,
    address: d.address ?? null,
    wouldPass,
  };
}

// GET /api/verification/status — everything the app needs to decide
// what UI to show: has this driver paid/verified their license, and
// what's the state of each of their vehicles' RC checks. Every vehicle
// is priced and checked identically now — no free/first-vehicle case.
router.get("/status", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const driverVerification = await prisma.driverVerification.findUnique({ where: { driverId: req.user.id } });
  const vehicles = await prisma.vehicle.findMany({
    where: { driverId: req.user.id },
    include: { verification: true },
    orderBy: { createdAt: "asc" },
  });

  // Once VERIFIED, the app shouldn't need to re-run a paid Eko check
  // just to display what was already confirmed — reshape the stored raw
  // response into the same preview shape the check step returns, so the
  // "already verified" screen can render it directly.
  const driverOut = driverVerification && driverVerification.licenseStatus === "VERIFIED"
    ? { ...driverVerification, confirmedPreview: buildLicensePreview(driverVerification.licenseEkoResponse, driverVerification.licenseEkoResponse?.data?.dl_number ?? null, true) }
    : driverVerification;

  const vehiclesOut = vehicles.map((v) => {
    if (v.verification?.rcStatus !== "VERIFIED") return v;
    return { ...v, verification: { ...v.verification, confirmedPreview: buildRcPreview(v.verification.rcEkoResponse, v.regNumber, true) } };
  });

  res.json({ driverVerification: driverOut, vehicles: vehiclesOut });
});

// POST /api/verification/driver/charge — flat, one-time license fee.
router.post("/driver/charge", requireAuth, requireRole("DRIVER"), async (req, res) => {
  let dv = await prisma.driverVerification.findUnique({ where: { driverId: req.user.id } });
  if (dv?.paymentStatus === "PAID") {
    return res.status(400).json({ error: "You're already verified." });
  }
  if (!dv) {
    dv = await prisma.driverVerification.create({ data: { driverId: req.user.id } });
  }

  const { licenseVerificationFeeInr } = await getAppConfig();
  const order = await razorpay.orders.create({
    amount: Math.round(licenseVerificationFeeInr * 100),
    currency: "INR",
    receipt: dv.id,
    notes: { driverVerificationId: dv.id },
  });
  await prisma.driverVerification.update({
    where: { id: dv.id },
    data: { paymentStatus: "CHARGE_ATTEMPTED", razorpayOrderId: order.id },
  });

  res.json({ orderId: order.id, amount: licenseVerificationFeeInr, keyId: process.env.RAZORPAY_KEY_ID });
});

// POST /api/verification/vehicle/:vehicleId/charge — RC-only, for ANY
// vehicle, including the first — every vehicle pays its own RC fee now.
router.post("/vehicle/:vehicleId/charge", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.vehicleId } });
  if (!vehicle || vehicle.driverId !== req.user.id) {
    return res.status(404).json({ error: "Vehicle not found." });
  }

  let vv = await prisma.vehicleVerification.findUnique({ where: { vehicleId: vehicle.id } });
  if (vv?.paymentStatus === "PAID") {
    return res.status(400).json({ error: "This vehicle is already verified." });
  }
  if (!vv) {
    vv = await prisma.vehicleVerification.create({ data: { vehicleId: vehicle.id } });
  }

  const { vehicleRcFeeInr } = await getAppConfig();
  const order = await razorpay.orders.create({
    amount: Math.round(vehicleRcFeeInr * 100),
    currency: "INR",
    receipt: vv.id,
    notes: { vehicleVerificationId: vv.id },
  });
  await prisma.vehicleVerification.update({
    where: { id: vv.id },
    data: { paymentStatus: "CHARGE_ATTEMPTED", razorpayOrderId: order.id },
  });

  res.json({ orderId: order.id, amount: vehicleRcFeeInr, keyId: process.env.RAZORPAY_KEY_ID });
});

// POST /api/verification/driver/mock-confirm-payment,
// POST /api/verification/vehicle/:vehicleId/mock-confirm-payment —
// same dev-only stand-in as payments.routes.js's own mock-confirm, same
// gate (ALLOW_MOCK_PAYMENT_CONFIRM), so the whole pay -> preview -> confirm
// -> badge flow is testable without a real Razorpay Checkout or webhook.
router.post("/driver/mock-confirm-payment", requireAuth, requireRole("DRIVER"), async (req, res) => {
  if (process.env.ALLOW_MOCK_PAYMENT_CONFIRM !== "true") {
    return res.status(404).json({ error: "Not found." });
  }
  // Unlike a booking (which always exists before its payment screen can
  // even open), a DriverVerification row normally only gets created by
  // /driver/charge's real Razorpay order call — which this mock path
  // deliberately skips entirely. Self-create it here so "simulate
  // payment" works standalone, without requiring a real charge first.
  let dv = await prisma.driverVerification.findUnique({ where: { driverId: req.user.id } });
  if (!dv) dv = await prisma.driverVerification.create({ data: { driverId: req.user.id } });
  const { licenseVerificationFeeInr } = await getAppConfig();
  await confirmDriverVerificationPayment(dv.id, `mock_${dv.id}`, licenseVerificationFeeInr);
  // Mirrors the real webhook's own emit (payments.routes.js) — this is
  // actually the only path testable today without RAZORPAY_WEBHOOK_SECRET
  // set, so the live-update behavior has to work here too, not just there.
  getIO()?.to(`user:${req.user.id}`).emit("verification:paymentConfirmed", { kind: "driver" });
  res.json({ success: true });
});

router.post("/vehicle/:vehicleId/mock-confirm-payment", requireAuth, requireRole("DRIVER"), async (req, res) => {
  if (process.env.ALLOW_MOCK_PAYMENT_CONFIRM !== "true") {
    return res.status(404).json({ error: "Not found." });
  }
  const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.vehicleId } });
  if (!vehicle || vehicle.driverId !== req.user.id) return res.status(404).json({ error: "Vehicle not found." });
  let vv = await prisma.vehicleVerification.findUnique({ where: { vehicleId: vehicle.id } });
  if (!vv) vv = await prisma.vehicleVerification.create({ data: { vehicleId: vehicle.id } });
  const { vehicleRcFeeInr } = await getAppConfig();
  await confirmVehicleVerificationPayment(vv.id, `mock_${vv.id}`, vehicleRcFeeInr);
  getIO()?.to(`user:${req.user.id}`).emit("verification:paymentConfirmed", { kind: "vehicle", vehicleId: vehicle.id });
  res.json({ success: true });
});

// POST /api/verification/driver/verify — the "check" step. Calls Eko
// once, stores the raw response, and leaves licenseStatus at PENDING
// rather than committing straight to VERIFIED/FAILED — the driver
// reviews what Eko actually returned (name, status, etc.) before it's
// treated as their official record. Requires payment already PAID.
router.post("/driver/verify", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const { dlNumber, dob } = req.body;
  const errors = validate(req.body, [
    { field: "dlNumber", check: (v) => typeof v === "string" && DL_NUMBER_PATTERN.test(v.trim()), message: "Enter a valid driving licence number." },
    { field: "dob", check: isValidDob, message: "Enter a valid date of birth (YYYY-MM-DD, must be 18 or older)." },
  ]);
  if (errors.length) return res.status(400).json({ errors });

  const dv = await prisma.driverVerification.findUnique({ where: { driverId: req.user.id } });
  if (!dv || dv.paymentStatus !== "PAID") {
    return res.status(400).json({ error: "Payment required before verification." });
  }
  if (dv.licenseStatus === "VERIFIED") {
    return res.json({ driverVerification: dv, preview: null });
  }

  const result = await verifyLicense(dlNumber, dob).catch((err) => ({ verified: false, raw: { error: err.message } }));
  const updatedDv = await prisma.driverVerification.update({
    where: { id: dv.id },
    data: { licenseStatus: "PENDING", licenseEkoResponse: result.raw },
  });

  res.json({
    driverVerification: updatedDv,
    preview: buildLicensePreview(result.raw, dlNumber, result.verified),
  });
});

// POST /api/verification/driver/verify/confirm — the driver has seen
// the preview above and is confirming it's them; this just commits the
// already-fetched Eko response to a final status. No second Eko call —
// avoids double-charging a paid-per-lookup vendor for one check.
router.post("/driver/verify/confirm", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const dv = await prisma.driverVerification.findUnique({ where: { driverId: req.user.id } });
  if (!dv || dv.licenseStatus !== "PENDING" || !dv.licenseEkoResponse) {
    return res.status(400).json({ error: "Nothing to confirm — run the check first." });
  }
  const updatedDv = await prisma.driverVerification.update({
    where: { id: dv.id },
    data: {
      licenseStatus: isLicenseVerified(dv.licenseEkoResponse) ? "VERIFIED" : "FAILED",
      licenseVerifiedAt: new Date(),
    },
  });
  res.json({ driverVerification: updatedDv });
});

// POST /api/verification/driver/reset — an already-VERIFIED (or FAILED)
// driver explicitly asking to redo their license check starts over from
// UNPAID, same as if they'd never paid — this is the "edit" affordance
// for license info once verified: nothing about it can be changed
// without a fresh paid Eko check, so "edit" really means "pay again."
router.post("/driver/reset", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const dv = await prisma.driverVerification.findUnique({ where: { driverId: req.user.id } });
  if (!dv || dv.licenseStatus === "UNVERIFIED") {
    return res.status(400).json({ error: "Nothing to reset." });
  }
  const updatedDv = await prisma.driverVerification.update({
    where: { id: dv.id },
    data: {
      paymentStatus: "UNPAID", razorpayOrderId: null, razorpayPaymentId: null, amountPaidInr: null, paidAt: null,
      licenseStatus: "UNVERIFIED", licenseEkoResponse: null, licenseVerifiedAt: null,
    },
  });
  res.json({ driverVerification: updatedDv });
});

// POST /api/verification/vehicle/:vehicleId/verify — RC "check" step,
// same preview-then-confirm shape as the license flow above. Requires
// this vehicle's own RC payment to be PAID — every vehicle, including
// the first, pays and checks independently now.
router.post("/vehicle/:vehicleId/verify", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.vehicleId } });
  if (!vehicle || vehicle.driverId !== req.user.id) {
    return res.status(404).json({ error: "Vehicle not found." });
  }
  const vv = await prisma.vehicleVerification.findUnique({ where: { vehicleId: vehicle.id } });
  if (!vv || !["PAID", "WAIVED"].includes(vv.paymentStatus)) {
    return res.status(400).json({ error: "Payment required before verification." });
  }
  if (vv.rcStatus === "VERIFIED") {
    return res.json({ vehicleVerification: vv, preview: null });
  }

  const result = await verifyRC(vehicle.regNumber).catch((err) => ({ verified: false, raw: { error: err.message } }));
  const updated = await prisma.vehicleVerification.update({
    where: { id: vv.id },
    data: { rcStatus: "PENDING", rcEkoResponse: result.raw },
  });

  res.json({
    vehicleVerification: updated,
    preview: buildRcPreview(result.raw, vehicle.regNumber, result.verified),
  });
});

// POST /api/verification/vehicle/:vehicleId/verify/confirm — commits
// the already-fetched RC response, no second Eko call.
router.post("/vehicle/:vehicleId/verify/confirm", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.vehicleId } });
  if (!vehicle || vehicle.driverId !== req.user.id) {
    return res.status(404).json({ error: "Vehicle not found." });
  }
  const vv = await prisma.vehicleVerification.findUnique({ where: { vehicleId: vehicle.id } });
  if (!vv || vv.rcStatus !== "PENDING" || !vv.rcEkoResponse) {
    return res.status(400).json({ error: "Nothing to confirm — run the check first." });
  }
  const updated = await prisma.vehicleVerification.update({
    where: { id: vv.id },
    data: {
      rcStatus: isRcVerified(vv.rcEkoResponse) ? "VERIFIED" : "FAILED",
      rcVerifiedAt: new Date(),
    },
  });
  res.json({ vehicleVerification: updated });
});

// GET /api/verification/passenger/status — deliberately its own
// endpoint, not folded into GET /status above: that one is hard-gated
// to requireRole("DRIVER"), but Aadhaar verification is reachable by
// any authenticated user (the same account can be both a driver and a
// passenger — see the User model's dual role support), so a
// driver-only gate would break it for a passenger-only account.
router.get("/passenger/status", requireAuth, async (req, res) => {
  const passengerVerification = await prisma.passengerVerification.findUnique({ where: { userId: req.user.id } });
  const out = passengerVerification && passengerVerification.aadhaarStatus === "VERIFIED"
    ? { ...passengerVerification, confirmedPreview: buildAadhaarPreview(passengerVerification.aadhaarEkoResponse, passengerVerification.aadhaarEkoResponse?.data?.aadhaar_number ?? null, true) }
    : passengerVerification;
  res.json({ passengerVerification: out });
});

// POST /api/verification/passenger/charge — flat, one-time Aadhaar fee.
router.post("/passenger/charge", requireAuth, async (req, res) => {
  let pv = await prisma.passengerVerification.findUnique({ where: { userId: req.user.id } });
  if (pv?.paymentStatus === "PAID") {
    return res.status(400).json({ error: "You're already verified." });
  }
  if (!pv) {
    pv = await prisma.passengerVerification.create({ data: { userId: req.user.id } });
  }

  const { aadhaarVerificationFeeInr } = await getAppConfig();
  const order = await razorpay.orders.create({
    amount: Math.round(aadhaarVerificationFeeInr * 100),
    currency: "INR",
    receipt: pv.id,
    notes: { passengerVerificationId: pv.id },
  });
  await prisma.passengerVerification.update({
    where: { id: pv.id },
    data: { paymentStatus: "CHARGE_ATTEMPTED", razorpayOrderId: order.id },
  });

  res.json({ orderId: order.id, amount: aadhaarVerificationFeeInr, keyId: process.env.RAZORPAY_KEY_ID });
});

// POST /api/verification/passenger/mock-confirm-payment — same dev-only
// stand-in as the driver/vehicle ones above, same gate.
router.post("/passenger/mock-confirm-payment", requireAuth, async (req, res) => {
  if (process.env.ALLOW_MOCK_PAYMENT_CONFIRM !== "true") {
    return res.status(404).json({ error: "Not found." });
  }
  let pv = await prisma.passengerVerification.findUnique({ where: { userId: req.user.id } });
  if (!pv) pv = await prisma.passengerVerification.create({ data: { userId: req.user.id } });
  const { aadhaarVerificationFeeInr } = await getAppConfig();
  await confirmPassengerVerificationPayment(pv.id, `mock_${pv.id}`, aadhaarVerificationFeeInr);
  getIO()?.to(`user:${req.user.id}`).emit("verification:paymentConfirmed", { kind: "passenger" });
  res.json({ success: true });
});

// POST /api/verification/passenger/verify/send-otp — STEP 1 of 2.
// Unlike license/RC's single-lookup check, Aadhaar e-KYC is
// OTP-consent-based: this call returns no personal data at all, only
// triggers Eko to send an OTP to whatever mobile number is actually
// linked with this Aadhaar in UIDAI's own records (never this app's own
// stored phone number) and stores the transaction id needed to pair
// with that OTP on confirm-otp below.
router.post("/passenger/verify/send-otp", requireAuth, async (req, res) => {
  const { aadhaarNumber } = req.body;
  const normalized = typeof aadhaarNumber === "string" ? aadhaarNumber.replace(/\s+/g, "") : aadhaarNumber;
  const errors = validate({ aadhaarNumber: normalized }, [
    { field: "aadhaarNumber", check: (v) => typeof v === "string" && AADHAAR_PATTERN.test(v), message: "Enter a valid 12-digit Aadhaar number." },
  ]);
  if (errors.length) return res.status(400).json({ errors });

  const pv = await prisma.passengerVerification.findUnique({ where: { userId: req.user.id } });
  if (!pv || pv.paymentStatus !== "PAID") {
    return res.status(400).json({ error: "Payment required before verification." });
  }
  if (pv.aadhaarStatus === "VERIFIED") {
    return res.json({ passengerVerification: pv, otpSent: false });
  }

  const result = await initiateAadhaarOtp(normalized).catch((err) => ({ success: false, raw: { error: err.message } }));
  if (!result.success) {
    // Doesn't touch aadhaarStatus — a failed OTP send (bad Aadhaar
    // number, Eko outage) isn't a verification *attempt* the way a
    // failed DL/RC lookup is, there's nothing to record yet.
    return res.status(400).json({ error: result.raw?.message || "Couldn't send an OTP for this Aadhaar number. Double-check it and try again." });
  }

  await prisma.passengerVerification.update({
    where: { id: pv.id },
    data: { aadhaarStatus: "PENDING", aadhaarOtpTxnId: result.txnId },
  });

  res.json({ otpSent: true });
});

// POST /api/verification/passenger/verify/confirm-otp — STEP 2 of 2.
// The resident's actual OTP consent — this is the only call that ever
// returns real e-KYC data, and it commits the final VERIFIED/FAILED
// status in the same request (unlike license/RC's confirm step, there's
// no separate "preview it first" beat here: UIDAI doesn't hand back
// anything to preview until the OTP itself is already verified, so
// there's nothing to show before this point and nothing left to decide
// after it).
router.post("/passenger/verify/confirm-otp", requireAuth, async (req, res) => {
  const { otp } = req.body;
  const errors = validate({ otp }, [
    { field: "otp", check: (v) => typeof v === "string" && /^\d{6}$/.test(v), message: "Enter the 6-digit OTP." },
  ]);
  if (errors.length) return res.status(400).json({ errors });

  const pv = await prisma.passengerVerification.findUnique({ where: { userId: req.user.id } });
  if (!pv || pv.aadhaarStatus !== "PENDING" || !pv.aadhaarOtpTxnId) {
    return res.status(400).json({ error: "Nothing to verify — send an OTP first." });
  }

  const result = await verifyAadhaarOtp(pv.aadhaarOtpTxnId, otp).catch((err) => ({ verified: false, raw: { error: err.message } }));
  const updatedPv = await prisma.passengerVerification.update({
    where: { id: pv.id },
    data: {
      aadhaarStatus: result.verified ? "VERIFIED" : "FAILED",
      aadhaarEkoResponse: result.raw,
      aadhaarVerifiedAt: new Date(),
      // Spent either way — a failed attempt needs a fresh send-otp
      // (and, per reset below, a fresh payment) to try again, same as
      // a wrong-code login OTP can't just be retried indefinitely.
      aadhaarOtpTxnId: null,
    },
  });

  res.json({
    passengerVerification: updatedPv,
    preview: result.verified ? buildAadhaarPreview(result.raw, result.raw?.data?.aadhaar_number, true) : null,
    error: result.verified ? undefined : (result.raw?.message || "Incorrect OTP or verification failed."),
  });
});

// POST /api/verification/passenger/reset — same "edit means pay again"
// affordance as driver/reset above.
router.post("/passenger/reset", requireAuth, async (req, res) => {
  const pv = await prisma.passengerVerification.findUnique({ where: { userId: req.user.id } });
  if (!pv || pv.aadhaarStatus === "UNVERIFIED") {
    return res.status(400).json({ error: "Nothing to reset." });
  }
  const updatedPv = await prisma.passengerVerification.update({
    where: { id: pv.id },
    data: {
      paymentStatus: "UNPAID", razorpayOrderId: null, razorpayPaymentId: null, amountPaidInr: null, paidAt: null,
      aadhaarStatus: "UNVERIFIED", aadhaarEkoResponse: null, aadhaarVerifiedAt: null, aadhaarOtpTxnId: null,
    },
  });
  res.json({ passengerVerification: updatedPv });
});

export default router;
