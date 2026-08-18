// Strips fields that should never reach the client as-is.
// passcodeHash is a bcrypt hash (not reversible), but there's still no
// reason to ship it — the client only ever needs to know *whether* a
// passcode exists, not what its hash looks like. photoR2Key/photoBase64
// are internal storage details — every call site that spreads this
// output back in also attaches a resolved `photoViewUrl` (see
// lib/photo.js's profilePhotoViewUrl), so shipping the raw column too
// would just be the same photo twice, and for photoBase64 specifically,
// several KB of duplicate payload on every single response that
// includes a user.
export function serializeUser(user) {
  if (!user) return user;
  const { passcodeHash, photoR2Key, photoBase64, ...rest } = user;
  return { ...rest, hasPasscode: !!passcodeHash };
}
