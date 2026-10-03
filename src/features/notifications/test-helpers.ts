import { createHash, createHmac, randomUUID } from "node:crypto";

const base64url = (value: string | Buffer) => Buffer.from(value).toString("base64url");

export type JobSignatureOptions = {
  key: string;
  url: string;
  body: string;
  issuer?: string;
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
