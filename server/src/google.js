// ======================================================================
//  google.js: talking to Firebase from the server
//   - checks a player's login token is real (signed by Google)
//   - reads/writes Firestore with the service account key
// ======================================================================

// ---------------------------------------------------------------- base64url helpers
const b64urlToBytes = s => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const bytesToB64url = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const strToB64url = s => bytesToB64url(new TextEncoder().encode(s));

export function serviceAccount(env) {
  if (env.TEST_MODE === "1") return { project_id: env.TEST_PROJECT || "demo-clapcatch" };
  if (!env.FIREBASE_SERVICE_ACCOUNT) throw new Error("FIREBASE_SERVICE_ACCOUNT secret is missing (see README)");
  return JSON.parse(String(env.FIREBASE_SERVICE_ACCOUNT).trim());
}

// ---------------------------------------------------------------- player login tokens
let jwks = null, jwksAt = 0;
export async function verifyIdToken(env, token) {
  if (!token) throw new Error("not logged in");
  if (env.TEST_MODE === "1") {                       // local tests only: "test:<uid>:<email>"
    const [, uid, email] = token.split(":");
    if (!uid) throw new Error("bad test token");
    return { uid, email };
  }
  const [h, p, sig] = token.split(".");
  if (!sig) throw new Error("bad token");
  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h)));
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
  const project = serviceAccount(env).project_id;
  const nowS = Date.now() / 1000;
  if (header.alg !== "RS256") throw new Error("bad token");
  if (payload.aud !== project || payload.iss !== "https://securetoken.google.com/" + project) throw new Error("token is for another project");
  if (!(payload.exp > nowS) || !(payload.iat < nowS + 300) || !payload.sub) throw new Error("login expired, log in again");
  if (!jwks || Date.now() - jwksAt > 3600_000) {
    const r = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
    jwks = (await r.json()).keys; jwksAt = Date.now();
  }
  const jwk = jwks.find(k => k.kid === header.kid);
  if (!jwk) { jwks = null; throw new Error("login expired, log in again"); }
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const good = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(sig), new TextEncoder().encode(h + "." + p));
  if (!good) throw new Error("bad token");
  return { uid: payload.sub, email: payload.email || "" };
}

// ---------------------------------------------------------------- Firestore access token
let access = null, accessExp = 0;
async function accessToken(env) {
  if (env.TEST_MODE === "1") return "test";
  if (access && Date.now() < accessExp - 60_000) return access;
  const sa = serviceAccount(env);
  const now = Math.floor(Date.now() / 1000);
  const unsigned = strToB64url(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." + strToB64url(JSON.stringify({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/datastore", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), c => c.charCodeAt(0)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" + unsigned + "." + bytesToB64url(sig),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("couldn't log the server into Firebase: " + JSON.stringify(j).slice(0, 200));
  access = j.access_token; accessExp = Date.now() + (j.expires_in || 3600) * 1000;
  return access;
}

// ---------------------------------------------------------------- Firestore values <-> plain JS
function enc(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  return { mapValue: { fields: encFields(v) } };
}
function encFields(o) { const f = {}; for (const k in o) if (o[k] !== undefined) f[k] = enc(o[k]); return f; }
function dec(v) {
  if (!v) return null;
  if ("nullValue" in v) return null;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("stringValue" in v) return v.stringValue;
  if ("timestampValue" in v) return Date.parse(v.timestampValue);
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(dec);
  if ("mapValue" in v) return decFields(v.mapValue.fields || {});
  return null;
}
function decFields(f) { const o = {}; for (const k in f) o[k] = dec(f[k]); return o; }

// ---------------------------------------------------------------- Firestore REST
const CACHE_MS = 120_000;
export class Store {
  constructor(env) {
    this.env = env;
    const project = serviceAccount(env).project_id;
    this.root = `projects/${project}/databases/(default)/documents`;
    this.base = (env.FIRESTORE_URL || "https://firestore.googleapis.com") + "/v1/" + this.root;
    this.cache = new Map(); this.qcache = new Map();
  }
  async call(method, url, body) {
    const r = await fetch(url, { method, headers: { authorization: "Bearer " + await accessToken(this.env), "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 404) return null;
    const j = await r.json().catch(() => ({}));
    if (r.status === 429 || (j.error && j.error.status === "RESOURCE_EXHAUSTED")) { const e = new Error("Firebase daily limit reached"); e.limit = "firebase"; throw e; }
    if (!r.ok) { const e = new Error((j.error && j.error.message) || ("Firestore error " + r.status)); e.status = r.status; throw e; }
    return j;
  }
  // The Bank is the only thing that writes to the database, so it can remember what it read.
  // That keeps Firebase's free daily reads (50,000) far away. Entries expire after 2 minutes anyway.
  async get(path, fresh) {
    const c = this.cache.get(path);
    if (!fresh && c && Date.now() - c.at < CACHE_MS) return c.data == null ? null : structuredClone(c.data);
    const j = await this.call("GET", this.base + "/" + path);
    const data = j ? decFields(j.fields || {}) : null;
    this.remember(path, data);
    return data == null ? null : structuredClone(data);
  }
  remember(path, data) {
    if (this.cache.size > 5000) this.cache.clear();
    this.cache.set(path, { at: Date.now(), data: data == null ? null : structuredClone(data) });
  }
  // several writes that all happen or none happen. ops: [{ set: path, data, mustNotExist }]
  async commit(ops) {
    const writes = ops.map(o => {
      const w = { update: { name: this.root + "/" + o.set, fields: encFields(o.data) } };
      if (o.mustNotExist) w.currentDocument = { exists: false };
      return w;
    });
    try { await this.call("POST", this.base + ":commit", { writes }); }
    catch (e) { ops.forEach(o => this.cache.delete(o.set)); throw e; }
    ops.forEach(o => this.remember(o.set, o.data));
    if (ops.some(o => o.set.startsWith("trades/"))) this.qcache.clear();
  }
  async set(path, data) { return this.commit([{ set: path, data }]); }
  async query(collection, field, op, value, limit = 50) {
    const qk = [collection, field, op, value, limit].join("|");
    const c = this.qcache.get(qk);
    if (c && Date.now() - c.at < CACHE_MS) return structuredClone(c.data);
    const j = await this.call("POST", this.base + ":runQuery", { structuredQuery: {
      from: [{ collectionId: collection }], where: { fieldFilter: { field: { fieldPath: field }, op, value: enc(value) } }, limit,
    } });
    const out = (j || []).filter(x => x.document).map(x => Object.assign({ id: x.document.name.split("/").pop() }, decFields(x.document.fields || {})));
    if (collection === "trades") { if (this.qcache.size > 2000) this.qcache.clear(); this.qcache.set(qk, { at: Date.now(), data: structuredClone(out) }); }
    return out;
  }
}
