// Standards-based Web Push sender using only the Web Crypto API, so the same
// code runs in Deno (Supabase Edge Functions), Node 20+ and browsers.
//  - Message encryption: RFC 8291 (aes128gcm content coding, RFC 8188)
//  - Sender authentication: RFC 8292 (VAPID, ES256 JWT)

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string; // base64url, 65-byte uncompressed P-256 point
  auth: string; // base64url, 16 bytes
}

export interface VapidKeys {
  publicKey: string; // base64url, 65-byte uncompressed P-256 point
  privateKey: string; // base64url, 32-byte scalar "d"
  subject: string; // "mailto:you@example.com" or an https URL
}

export interface SendOptions {
  ttlSeconds?: number;
  urgency?: "very-low" | "low" | "normal" | "high";
  /** Push services replace a not-yet-delivered message with the same topic. */
  topic?: string;
}

export interface SendResult {
  ok: boolean;
  status: number;
  /** true when the subscription is permanently invalid (404/410). */
  gone: boolean;
  body?: string;
}

const enc = new TextEncoder();

export function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(str: string): Uint8Array {
  const s = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = s + "===".slice((s.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

// Typed-array → ArrayBuffer copy (avoids SharedArrayBuffer typing issues).
function buf(u: Uint8Array): ArrayBuffer {
  return u.slice().buffer as ArrayBuffer;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", buf(ikm), "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: buf(salt), info: buf(info) },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

/** Encrypts a payload for one subscription (RFC 8291, single record). */
export async function encryptPayload(
  payload: Uint8Array,
  p256dh: string,
  authSecret: string,
  testing?: { salt?: Uint8Array; keyPair?: CryptoKeyPair },
): Promise<Uint8Array> {
  const uaPublic = b64urlDecode(p256dh);
  const auth = b64urlDecode(authSecret);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error("Invalid p256dh key");
  if (auth.length < 16) throw new Error("Invalid auth secret");

  const asKeys =
    testing?.keyPair ??
    ((await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", asKeys.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", buf(uaPublic), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asKeys.privateKey, 256),
  );

  const keyInfo = concat(enc.encode("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hkdf(auth, ecdhSecret, keyInfo, 32);
  const salt = testing?.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  const recordSize = 4096;
  const plaintext = concat(payload, new Uint8Array([2])); // 0x02 = last record delimiter
  if (plaintext.length + 16 > recordSize) throw new Error("Payload too large for one record");
  const aesKey = await crypto.subtle.importKey("raw", buf(cek), "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: buf(nonce), tagLength: 128 }, aesKey, buf(plaintext)),
  );

  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, recordSize);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, ciphertext);
}

async function importVapidPrivateKey(vapid: VapidKeys): Promise<CryptoKey> {
  const pub = b64urlDecode(vapid.publicKey);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error("Invalid VAPID public key");
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    d: vapid.privateKey,
    x: b64urlEncode(pub.slice(1, 33)),
    y: b64urlEncode(pub.slice(33, 65)),
    ext: true,
  };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

/** Builds the VAPID Authorization header value for a push endpoint. */
export async function vapidAuthorization(endpoint: string, vapid: VapidKeys, nowSeconds?: number): Promise<string> {
  const aud = new URL(endpoint).origin;
  const now = nowSeconds ?? Math.floor(Date.now() / 1000);
  const header = b64urlEncode(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64urlEncode(enc.encode(JSON.stringify({ aud, exp: now + 12 * 3600, sub: vapid.subject })));
  const signingInput = `${header}.${claims}`;
  const key = await importVapidPrivateKey(vapid);
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, buf(enc.encode(signingInput))),
  );
  return `vapid t=${signingInput}.${b64urlEncode(sig)}, k=${vapid.publicKey}`;
}

/** Push service topic: max 32 chars from the URL-safe base64 alphabet. */
export async function topicFor(key: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", buf(enc.encode(key))));
  return b64urlEncode(digest).slice(0, 32);
}

export async function sendWebPush(
  sub: PushSubscriptionKeys,
  payload: unknown,
  vapid: VapidKeys,
  options: SendOptions = {},
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  const body = await encryptPayload(enc.encode(JSON.stringify(payload)), sub.p256dh, sub.auth);
  const headers: Record<string, string> = {
    Authorization: await vapidAuthorization(sub.endpoint, vapid),
    "Content-Encoding": "aes128gcm",
    "Content-Type": "application/octet-stream",
    TTL: String(options.ttlSeconds ?? 3600),
    Urgency: options.urgency ?? "high",
  };
  if (options.topic) headers.Topic = options.topic;
  const res = await fetchImpl(sub.endpoint, { method: "POST", headers, body: buf(body) });
  const text = res.ok ? undefined : (await res.text().catch(() => "")).slice(0, 300);
  return { ok: res.status >= 200 && res.status < 300, status: res.status, gone: res.status === 404 || res.status === 410, body: text };
}

/** Generates a VAPID key pair (base64url public point + private scalar). */
export async function generateVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const kp = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
  return { publicKey: b64urlEncode(pub), privateKey: jwk.d as string };
}
