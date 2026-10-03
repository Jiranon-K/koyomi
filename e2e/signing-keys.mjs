// QStash signing keys that exist only on the end-to-end server (e2e/server.mjs sets them) and in
// the tests that sign job calls for it. They sign nothing anywhere else.
export const E2E_SIGNING_KEYS = {
  current: "e2e-only-current-signing-key",
  next: "e2e-only-next-signing-key",
};
