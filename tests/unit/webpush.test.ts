import { createECDH, createPublicKey, randomBytes, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
// @ts-expect-error - http_ece ships without types
import ece from "http_ece";
import {
  b64urlDecode,
  b64urlEncode,
  encryptPayload,
  generateVapidKeys,
  sendWebPush,
  topicFor,
  vapidAuthorization,
} from "@shared/webpush.ts";

function receiver() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const auth = randomBytes(16);
  return { ecdh, p256dh: b64urlEncode(ecdh.getPublicKey()), auth: b64urlEncode(auth) };
}

describe("Web Push encryption (RFC 8291)", () => {
  it("produces a message the receiver can decrypt", async () => {
    const r = receiver();
    const payload = JSON.stringify({ title: "Lunch", body: "Overnight oats 🥣" });
    const body = await encryptPayload(new TextEncoder().encode(payload), r.p256dh, r.auth);
    const plain = ece.decrypt(Buffer.from(body), { version: "aes128gcm", privateKey: r.ecdh, authSecret: r.auth });
    expect(plain.toString("utf8")).toBe(payload);
    // header: 16 salt + 4 rs + 1 idlen + 65 key
    expect(new DataView(body.buffer).getUint32(16)).toBe(4096);
    expect(body[20]).toBe(65);
  });

  it("rejects malformed subscription keys", async () => {
    await expect(encryptPayload(new Uint8Array([1]), b64urlEncode(new Uint8Array(10)), b64urlEncode(new Uint8Array(16)))).rejects.toThrow();
  });
});

describe("VAPID (RFC 8292)", () => {
  it("signs a valid ES256 JWT for the push service origin", async () => {
    const keys = await generateVapidKeys();
    const header = await vapidAuthorization("https://web.push.apple.com/QGuQyavXut", {
      ...keys,
      subject: "mailto:me@example.com",
    }, 1_800_000_000);
    const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header)!;
    expect(m).toBeTruthy();
    const claims = JSON.parse(Buffer.from(b64urlDecode(m[2])).toString());
    expect(claims).toEqual({ aud: "https://web.push.apple.com", exp: 1_800_000_000 + 43200, sub: "mailto:me@example.com" });
    expect(m[4]).toBe(keys.publicKey);
    const pub = b64urlDecode(keys.publicKey);
    const key = createPublicKey({
      key: { kty: "EC", crv: "P-256", x: b64urlEncode(pub.slice(1, 33)), y: b64urlEncode(pub.slice(33)) },
      format: "jwk",
    });
    const ok = verify("sha256", Buffer.from(`${m[1]}.${m[2]}`), { key, dsaEncoding: "ieee-p1363" }, Buffer.from(b64urlDecode(m[3])));
    expect(ok).toBe(true);
  });

  it("sends with the required headers and reports expired subscriptions", async () => {
    const keys = await generateVapidKeys();
    const r = receiver();
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response("", { status: 410 });
    }) as unknown as typeof fetch;
    const res = await sendWebPush(
      { endpoint: "https://fcm.googleapis.com/fcm/send/abc", p256dh: r.p256dh, auth: r.auth },
      { title: "x" },
      { ...keys, subject: "mailto:a@b.c" },
      { topic: await topicFor("k"), ttlSeconds: 60 },
      fake,
    );
    expect(res).toMatchObject({ ok: false, status: 410, gone: true });
    const h = calls[0].init.headers as Record<string, string>;
    expect(h["Content-Encoding"]).toBe("aes128gcm");
    expect(h.TTL).toBe("60");
    expect(h.Urgency).toBe("high");
    expect(h.Topic).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });
});
