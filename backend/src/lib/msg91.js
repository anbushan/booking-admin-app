// Thin wrapper around MSG91's OTP API. Only called when the request
// does NOT match the dev static-OTP bypass (see routes/auth.routes.js).
export async function sendOtpViaMsg91(phone, otp) {
  if (!process.env.MSG91_AUTH_KEY) {
    throw new Error(
      "MSG91_AUTH_KEY is not set. In development, use a whitelisted DEV_TEST_NUMBERS entry to skip real SMS sending."
    );
  }

  const res = await fetch("https://control.msg91.com/api/v5/otp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authkey: process.env.MSG91_AUTH_KEY,
    },
    body: JSON.stringify({
      template_id: process.env.MSG91_OTP_TEMPLATE_ID,
      mobile: `91${phone}`,
      otp,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`MSG91 send failed: ${res.status} ${body}`);
  }

  return res.json();
}

// Plain transactional SMS (not the OTP-specific endpoint above) — used
// for SOS alerts, which need a registered DLT template of their own
// (e.g. "{#var#} needs help near {#var#}. Live location: {#var#}").
export async function sendSmsViaMsg91(phone, templateId, variables) {
  if (!process.env.MSG91_AUTH_KEY) {
    console.error("MSG91_AUTH_KEY not set — SOS SMS not sent. In dev this is expected.");
    return { skipped: true };
  }

  const res = await fetch("https://control.msg91.com/api/v5/flow", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authkey: process.env.MSG91_AUTH_KEY,
    },
    body: JSON.stringify({
      template_id: templateId,
      recipients: [{ mobiles: `91${phone}`, ...variables }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`MSG91 SMS send failed: ${res.status} ${body}`);
  }

  return res.json();
}
