// End-to-end encryption helpers using the WebCrypto API.
//
// Algorithm:
//   - PBKDF2-SHA256, 250,000 iterations, 16-byte salt
//   - AES-GCM with 256-bit key and 12-byte random IV per message
//
// On-the-wire envelope format:
//   v1:<base64-iv>:<base64-ciphertext>
//
// The server only ever sees the envelope. It has no way to decrypt
// without the passphrase, which never leaves the browser.

const PBKDF2_ITERATIONS = 600000;
const VERIFY_PLAINTEXT = 'ltwl-verify-ok';

const enc = new TextEncoder();
const dec = new TextDecoder();

// ---------- base64 helpers ----------

export function bufToB64(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function b64ToBuf(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ---------- key material ----------

export function newSaltB64() {
  return bufToB64(crypto.getRandomValues(new Uint8Array(16)));
}

export async function deriveKey(passphrase, saltB64) {
  if (!passphrase) throw new Error('Passphrase is required');
  if (!saltB64) throw new Error('Salt is required');

  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: b64ToBuf(saltB64),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// ---------- encrypt / decrypt ----------

export async function encryptText(key, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext ?? '')
  );
  return `v1:${bufToB64(iv)}:${bufToB64(ct)}`;
}

export async function decryptText(key, blob) {
  if (blob == null) return '';
  // legacy or unencrypted (no envelope) — return as-is
  if (typeof blob !== 'string' || !blob.startsWith('v1:')) return blob;
  const [, ivB64, ctB64] = blob.split(':');
  if (!ivB64 || !ctB64) throw new Error('Malformed ciphertext');
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBuf(ivB64) },
    key,
    b64ToBuf(ctB64)
  );
  return dec.decode(pt);
}

// ---------- verification blob (for confirming a passphrase) ----------

export function makeVerificationBlob(key) {
  return encryptText(key, VERIFY_PLAINTEXT);
}

export async function verifyKey(key, blob) {
  try {
    const decrypted = await decryptText(key, blob);
    return decrypted === VERIFY_PLAINTEXT;
  } catch {
    return false;
  }
}

// ---------- session storage for the passphrase ----------
//
// Stored in sessionStorage so it dies when the tab closes. localStorage
// would survive longer but also be visible to anyone using the device.

const PASS_KEY = 'ltwl_passphrase';

export function rememberPassphrase(passphrase) {
  try { sessionStorage.setItem(PASS_KEY, passphrase); } catch { /* ignore */ }
}

export function recallPassphrase() {
  try { return sessionStorage.getItem(PASS_KEY); } catch { return null; }
}

export function forgetPassphrase() {
  try { sessionStorage.removeItem(PASS_KEY); } catch { /* ignore */ }
}
