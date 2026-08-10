// Strips fields that should never reach the client as-is.
// passcodeHash is a bcrypt hash (not reversible), but there's still no
// reason to ship it — the client only ever needs to know *whether* a
// passcode exists, not what its hash looks like.
export function serializeUser(user) {
  if (!user) return user;
  const { passcodeHash, ...rest } = user;
  return { ...rest, hasPasscode: !!passcodeHash };
}
