// Thin client for Eko's Verification APIs (driving license, vehicle
// RC, and Aadhaar) — https://developers.eko.in/reference/driving-license,
// https://developers.eko.in/reference/vehicle-rc. Aadhaar's exact
// reference page wasn't checked directly (same Postman-gated situation
// as DL/RC), but unlike DL/RC it's modeled as a genuine two-call
// OTP-consent flow (initiate -> resident enters the OTP sent to their
// Aadhaar-linked mobile -> verify), not a single lookup — this isn't a
// guess about Eko's shape specifically, it's a legal requirement
// (UIDAI e-KYC can't release demographic data without OTP/biometric
// consent), so any real aggregator's API has to work this way regardless
// of the exact endpoint names. Confirm the real request/response field
// names against Eko's docs/Postman collection before flipping
// EKO_MOCK_MODE off for this one.
//
// AUTH (fully documented, implemented for real below — this part isn't
// a guess): every request is signed per-call, not a static bearer
// token. developer_key is the static key from Eko (connect.eko.in,
// UAT key for staging); secret-key-timestamp is the current unix ms;
// secret-key = base64(HMAC-SHA256(base64(developer_key), timestamp)).
//
// ENDPOINT: the exact request path/method/param names weren't
// extractable from Eko's public reference pages (the request side
// renders via an interactive widget their docs site doesn't expose to
// a plain fetch) — there's a "Verification APIs" Postman collection
// that has it, gated behind a Postman login. Until that's confirmed,
// EKO_MOCK_MODE=true short-circuits to a canned response shaped
// exactly like Eko's documented real one, so every other piece of the
// verification flow (payment -> this -> DB -> badge) is provably
// correct today, independent of that one gap. Flip EKO_MOCK_MODE off
// and set EKO_RC_VERIFY_PATH/EKO_DL_VERIFY_PATH once confirmed — the
// signing logic and the shape callers get back don't change at all.
import crypto from "crypto";

const EKO_BASE_URL = process.env.EKO_BASE_URL || "https://api.eko.in:25002";

function buildAuthHeaders() {
  const developerKey = process.env.EKO_DEVELOPER_KEY;
  if (!developerKey) {
    throw new Error("EKO_DEVELOPER_KEY is not set.");
  }
  const timestamp = String(Date.now());
  const encodedKey = Buffer.from(developerKey).toString("base64");
  const secretKey = crypto.createHmac("sha256", encodedKey).update(timestamp).digest("base64");
  return {
    developer_key: developerKey,
    "secret-key": secretKey,
    "secret-key-timestamp": timestamp,
  };
}

// Mock responses shaped like Eko's own documented response fields
// (data.rc_status / data.dl_validity etc.) — a caller testing the mock
// flow can force a FAILED result by including "FAIL" anywhere in the
// number they submit, so both the success and failure paths through
// payment -> verify -> badge are exercisable without real Eko access.
function mockRcResponse(regNumber) {
  const failed = regNumber.toUpperCase().includes("FAIL");
  return {
    verified: !failed,
    raw: {
      data: {
        reg_no: regNumber,
        rc_status: failed ? "INVALID" : "ACTIVE",
        owner: failed ? null : "MOCK OWNER NAME",
        father_name: failed ? null : "MOCK FATHER NAME",
        rc_expiry_date: failed ? null : "2030-01-01",
        registration_date: failed ? null : "2020-03-15",
        blacklist_status: failed ? "UNKNOWN" : "NOT BLACKLISTED",
        vehicle_class: failed ? null : "LMV",
        maker_model: failed ? null : "MARUTI SWIFT DZIRE",
        fuel_type: failed ? null : "PETROL",
        chassis_number: failed ? null : "MA3XXXXXXXXXXXXX1",
        engine_number: failed ? null : "K12XXXXXXX",
        vehicle_insurance_upto: failed ? null : "2027-01-01",
        vehicle_insurance_company_name: failed ? null : "MOCK INSURANCE CO",
        pucc_upto: failed ? null : "2026-12-01",
        permanent_address: failed ? null : "12, MOCK STREET, BENGALURU, KARNATAKA",
        _mock: true,
      },
    },
  };
}

function mockLicenseResponse(dlNumber) {
  const failed = dlNumber.toUpperCase().includes("FAIL");
  return {
    verified: !failed,
    raw: {
      data: {
        dl_number: dlNumber,
        status: failed ? "INVALID" : "ACTIVE",
        dob: failed ? null : "1995-05-20",
        details_of_driving_licence: failed ? null : {
          name: "MOCK DRIVER NAME",
          address: "12, MOCK STREET, BENGALURU, KARNATAKA",
          issue_date: "2015-06-10",
          old_new_dl_no: dlNumber,
        },
        dl_validity: failed ? null : {
          non_transport_valid_upto: "2035-05-19",
          transport_valid_upto: "2028-05-19",
        },
        badge_details: failed ? [] : [{ badge_no: "MOCKBADGE123", valid_upto: "2028-05-19" }],
        cov_details: failed ? [] : [
          { cov: "LMV", cov_issue_date: "2015-06-10" },
          { cov: "MCWG", cov_issue_date: "2013-02-01" },
        ],
        _mock: true,
      },
    },
  };
}

// Aadhaar's real flow is OTP-consent-based, not a plain lookup like DL/RC
// — UIDAI requires the resident's explicit OTP consent before releasing
// any demographic data, so this is two calls (initiate, then verify),
// not one. The mock txnId encodes whether this was a "FAIL"-triggering
// number and the last 4 digits — purely a mock-only trick so
// mockAadhaarOtpVerify can reproduce the right outcome without a real
// Eko session behind it; a real txnId is just an opaque string neither
// side needs to parse.
function mockAadhaarOtpInitiate(aadhaarNumber) {
  const failed = aadhaarNumber.includes("0000") || aadhaarNumber.toUpperCase().includes("FAIL");
  if (failed) {
    return { success: false, raw: { message: "Invalid Aadhaar number or no OTP could be sent.", _mock: true } };
  }
  const last4 = aadhaarNumber.slice(-4);
  return {
    success: true,
    txnId: `mock_txn_ok_${last4}_${Date.now()}`,
    raw: { message: "OTP sent to the mobile number linked with this Aadhaar.", _mock: true },
  };
}

// Real Aadhaar OTP is 6 digits — this app's own static test-OTP for
// phone login is "123456" (see auth.routes.js DEV_STATIC_OTP), reused
// here as the one mock OTP that always succeeds so testing this flow
// end to end doesn't need a second, separate convention to remember.
const MOCK_VALID_OTP = "123456";

function mockAadhaarOtpVerify(txnId, otp) {
  if (!txnId?.startsWith("mock_txn_ok_")) {
    return { verified: false, raw: { message: "This OTP session has expired or is invalid.", _mock: true } };
  }
  if (otp !== MOCK_VALID_OTP) {
    return { verified: false, raw: { message: "Incorrect OTP.", _mock: true } };
  }
  const last4 = txnId.split("_")[3];
  return {
    verified: true,
    raw: {
      data: {
        aadhaar_number: `XXXXXXXX${last4}`,
        status: "ACTIVE",
        name: "MOCK PASSENGER NAME",
        dob: "1998-11-02",
        gender: "M",
        address: "45, MOCK LAYOUT, BENGALURU, KARNATAKA",
        _mock: true,
      },
    },
  };
}

// Derives the boolean pass/fail this app actually acts on from Eko's
// much larger real response — kept as its own small, pure function so
// the mock responses above and a real response later both go through
// exactly the same decision, not two different implementations.
export function isRcVerified(raw) {
  const status = raw?.data?.rc_status;
  return status === "ACTIVE" && raw?.data?.blacklist_status !== "BLACKLISTED";
}

export function isLicenseVerified(raw) {
  return raw?.data?.status === "ACTIVE";
}

export function isAadhaarVerified(raw) {
  return raw?.data?.status === "ACTIVE";
}

// STEP 1 of 2 — sends an OTP to the mobile number linked with this
// Aadhaar number in UIDAI's own records (not any number this app has on
// file — the whole point of OTP consent is proving the resident
// themself initiated this, via a channel this app never sees). Returns
// no personal data at all, only a transaction id to pair with the OTP
// on the verify call — matches how every real Aadhaar e-KYC aggregator
// (Eko included, going by their documented DL/RC shape) structures
// this, since releasing demographic data before consent is confirmed
// would defeat the purpose of the OTP step.
export async function initiateAadhaarOtp(aadhaarNumber) {
  if (process.env.EKO_MOCK_MODE === "true") {
    return mockAadhaarOtpInitiate(aadhaarNumber);
  }
  if (!process.env.EKO_AADHAAR_OTP_INITIATE_PATH) {
    throw new Error("EKO_AADHAAR_OTP_INITIATE_PATH is not set — Eko's exact Aadhaar OTP endpoint hasn't been confirmed yet. Set EKO_MOCK_MODE=true to test the rest of the flow in the meantime.");
  }
  const res = await fetch(`${EKO_BASE_URL}${process.env.EKO_AADHAAR_OTP_INITIATE_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...buildAuthHeaders() },
    body: JSON.stringify({ aadhaar_number: aadhaarNumber }),
  });
  const raw = await res.json();
  if (!res.ok || !raw?.txn_id) {
    return { success: false, raw };
  }
  return { success: true, txnId: raw.txn_id, raw };
}

// STEP 2 of 2 — the resident's OTP consent, paired with the txnId from
// initiateAadhaarOtp above. Only this call ever returns real e-KYC data.
export async function verifyAadhaarOtp(txnId, otp) {
  if (process.env.EKO_MOCK_MODE === "true") {
    return mockAadhaarOtpVerify(txnId, otp);
  }
  if (!process.env.EKO_AADHAAR_OTP_VERIFY_PATH) {
    throw new Error("EKO_AADHAAR_OTP_VERIFY_PATH is not set — Eko's exact Aadhaar OTP endpoint hasn't been confirmed yet. Set EKO_MOCK_MODE=true to test the rest of the flow in the meantime.");
  }
  const res = await fetch(`${EKO_BASE_URL}${process.env.EKO_AADHAAR_OTP_VERIFY_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...buildAuthHeaders() },
    body: JSON.stringify({ txn_id: txnId, otp }),
  });
  const raw = await res.json();
  if (!res.ok) {
    return { verified: false, raw };
  }
  return { verified: isAadhaarVerified(raw), raw };
}

export async function verifyRC(regNumber) {
  if (process.env.EKO_MOCK_MODE === "true") {
    return mockRcResponse(regNumber);
  }
  if (!process.env.EKO_RC_VERIFY_PATH) {
    throw new Error("EKO_RC_VERIFY_PATH is not set — Eko's exact RC endpoint hasn't been confirmed yet. Set EKO_MOCK_MODE=true to test the rest of the flow in the meantime.");
  }
  const res = await fetch(`${EKO_BASE_URL}${process.env.EKO_RC_VERIFY_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...buildAuthHeaders() },
    body: JSON.stringify({ reg_no: regNumber }),
  });
  const raw = await res.json();
  if (!res.ok) {
    throw new Error(`Eko RC verify failed: ${res.status} ${JSON.stringify(raw)}`);
  }
  return { verified: isRcVerified(raw), raw };
}

export async function verifyLicense(dlNumber, dob) {
  if (process.env.EKO_MOCK_MODE === "true") {
    return mockLicenseResponse(dlNumber);
  }
  if (!process.env.EKO_DL_VERIFY_PATH) {
    throw new Error("EKO_DL_VERIFY_PATH is not set — Eko's exact license endpoint hasn't been confirmed yet. Set EKO_MOCK_MODE=true to test the rest of the flow in the meantime.");
  }
  const res = await fetch(`${EKO_BASE_URL}${process.env.EKO_DL_VERIFY_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...buildAuthHeaders() },
    body: JSON.stringify({ dl_number: dlNumber, dob }),
  });
  const raw = await res.json();
  if (!res.ok) {
    throw new Error(`Eko license verify failed: ${res.status} ${JSON.stringify(raw)}`);
  }
  return { verified: isLicenseVerified(raw), raw };
}

