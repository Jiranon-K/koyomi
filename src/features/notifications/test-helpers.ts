import { createHash, createHmac, randomUUID } from "node:crypto";

// For tests only (unit and end-to-end): builds the `Upstash-Signature` token the way QStash does,
// so a job Route Handler can be called with a valid signature, or with one that is wrong in
// exactly one way.

const base64url = (value: string | Buffer) => Buffer.from(value).toString("base64url");

export type JobSignatureOptions = {
  /** The signing key QStash would use. */
  key: string;
  /** The URL the call is sent to. */
  url: string;
  /** The raw request body. */
  body: string;
  issuer?: string;
  /** Seconds from now until the token expires; negative for one that already has. */
  expiresIn?: number;
  algorithm?: "HS256" | "none";
};

export function signJob(options: JobSignatureOptions): string {
  const { key, url, body, issuer = "Upstash", expiresIn = 300, algorithm = "HS256" } = options;
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: algorithm, typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: issuer,
      sub: url,
      exp: now + expiresIn,
      nbf: Math.min(now, now + expiresIn) - 1,
      iat: now,
      jti: randomUUID(),
      body: createHash("sha256").update(body).digest("base64url"),
    }),
  );
  const signature =
    algorithm === "none"
      ? ""
      : createHmac("sha256", key).update(`${header}.${claims}`).digest("base64url");
  return `${header}.${claims}.${signature}`;
}
