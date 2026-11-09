// Generates the secrets FitFlow needs. Uses only Node's built-in Web Crypto.
//   VAPID key pair  (Web Push sender identity)
//   CRON_SECRET     (lets pg_cron call the Edge Function)
// Nothing is saved to disk: copy the values from the window.
import { webcrypto as crypto } from "node:crypto";

const b64url = (bytes) => Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const publicKey = b64url(new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey)));
const privateKey = (await crypto.subtle.exportKey("jwk", kp.privateKey)).d;
const cronSecret = b64url(crypto.getRandomValues(new Uint8Array(32)));

console.log(`
FitFlow keys — generated ${new Date().toISOString()}
====================================================================
1) PUBLIC (goes into docs/config.js -> vapidPublicKey, and Supabase secret VAPID_PUBLIC_KEY):

VAPID_PUBLIC_KEY=${publicKey}

2) PRIVATE — Supabase Edge Function secrets ONLY. Never put these in config.js or GitHub:

VAPID_PRIVATE_KEY=${privateKey}
CRON_SECRET=${cronSecret}

3) Also add this Supabase secret (use your own email address):

VAPID_SUBJECT=mailto:you@example.com
====================================================================
Keep this window open until you have copied everything. If you lose the
private key, run this again and repeat the setup (phones must re-enable
notifications after the VAPID key changes).
`);
