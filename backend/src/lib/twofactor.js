// Thin wrapper around 2Factor's SMS OTP API — replaces MSG91 for
// login/register OTP (see routes/auth.routes.js). MSG91's OTP delivery
// was blocked all session on a missing template_id; switching providers
// per the account holder's own request rather than continuing to chase
// that configuration gap.
//
// Uses 2Factor's "custom OTP" send form — https://2factor.in/API/V1/
// <api_key>/SMS/<phone>/<otp>/<template_name> — which sends an OTP value
// WE generate (same as MSG91's integration), not 2Factor's own AUTOGEN
// mode (which would generate and verify server-side on their end
// instead of ours). Deliberately kept this way: auth.routes.js's
// generate-store-in-Redis-verify-locally flow doesn't change at all,
// only which provider actually delivers the SMS.
//
// SOS alerts (lib/msg91.js sendSmsViaMsg91) are UNCHANGED — still MSG91,
// pending a separate 2Factor template for that.
export async function sendOtpViaTwoFactor(phone, otp) {
  if (!process.env.TWOFACTOR_API_KEY) {
    throw new Error(
      "TWOFACTOR_API_KEY is not set. In development, use a whitelisted DEV_TEST_NUMBERS entry to skip real SMS sending."
    );
  }
  const templateName = process.env.TWOFACTOR_OTP_TEMPLATE_NAME || "Test";

  const url = `https://2factor.in/API/V1/${process.env.TWOFACTOR_API_KEY}/SMS/${phone}/${otp}/${encodeURIComponent(templateName)}`;
  const res = await fetch(url);

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`2Factor send failed: ${res.status} ${body}`);
  }

  const data = await res.json();
  // 2Factor returns 200 OK even for some failure cases (invalid API key,
  // DND-blocked number, etc.) — Status is the real success signal, same
  // reason MSG91's response.json() was worth inspecting rather than just
  // trusting res.ok.
  if (data.Status !== "Success") {
    throw new Error(`2Factor send failed: ${data.Details || JSON.stringify(data)}`);
  }

  return data;
}
