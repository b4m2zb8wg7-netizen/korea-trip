/* Korea Trip — Cloudflare Worker for live sync between phones.
 *
 * It's a tiny shared "locker": each trip plan is stored under a secret code.
 * Anyone with the code can read & write that plan — so treat the code like a
 * password and only share it with people you want editing the trip.
 *
 * SETUP (Cloudflare dashboard):
 *   1. Create a KV namespace (Storage & Databases → KV) — e.g. "korea-trip-kv".
 *   2. Create a Worker (Workers & Pages → Create → Worker), paste this file, Deploy.
 *   3. Bind the KV namespace to the Worker:
 *        Worker → Settings → Bindings → add KV namespace
 *        Variable name MUST be exactly: TRIP_KV
 *      then Deploy again.
 *   4. Copy the Worker URL (https://<name>.<you>.workers.dev) into the app's Sync panel.
 *
 * Endpoints:
 *   GET  /trip/<code>   → returns the stored plan JSON (or null)
 *   PUT  /trip/<code>   → saves the plan JSON in the body
 */

const CORS = {
  "Access-Control-Allow-Origin": "*", // the secret code is the access control
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS }); // CORS preflight
    }

    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean); // ["trip", "<code>"]
    if (parts[0] !== "trip" || !parts[1]) {
      return json({ error: "Use /trip/<code>" }, 400);
    }

    const code = parts[1];
    // Codes are letters/numbers/-/_ , 6–64 chars. Rejects junk + path tricks.
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(code)) {
      return json({ error: "Bad trip code" }, 400);
    }
    const key = "trip:" + code;

    if (request.method === "GET") {
      const data = await env.TRIP_KV.get(key);
      return json(data ? JSON.parse(data) : null);
    }

    if (request.method === "PUT") {
      let body;
      try { body = await request.json(); }
      catch { return json({ error: "Invalid JSON" }, 400); }

      const str = JSON.stringify(body);
      if (str.length > 256 * 1024) { // ~256 KB cap — a trip plan is a few KB
        return json({ error: "Plan too large" }, 413);
      }
      await env.TRIP_KV.put(key, str);
      return json({ ok: true });
    }

    return json({ error: "Method not allowed" }, 405);
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}
