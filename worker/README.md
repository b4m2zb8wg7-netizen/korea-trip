# Live sync setup (Cloudflare Worker + KV)

This lets two phones share the same trip plan live. The plan is stored in a tiny
Cloudflare "KV" store under a secret **trip code**. Anyone with the code can read
and edit the plan, so share it only with people you want planning the trip.

## One-time setup (all in the Cloudflare dashboard — no command line)

1. **Create the storage (KV namespace)**
   - Cloudflare dashboard → **Storage & Databases** → **KV** → **Create a namespace**.
   - Name it `korea-trip-kv` → Create.

2. **Create the Worker**
   - **Workers & Pages** → **Create** → **Workers** → **Create Worker**.
   - Give it a name like `korea-trip-sync` → **Deploy** (it deploys a hello-world).
   - Click **Edit code**, delete what's there, paste the contents of
     [`sync-worker.js`](sync-worker.js), then **Deploy**.

3. **Connect the storage to the Worker**
   - On the Worker page → **Settings** → **Bindings** → **Add** → **KV namespace**.
   - **Variable name:** `TRIP_KV` (exactly) · **KV namespace:** `korea-trip-kv`.
   - **Deploy** again.

4. **Copy the Worker URL** — it looks like
   `https://korea-trip-sync.<your-subdomain>.workers.dev`.

## Turn it on in the app (both phones)

1. Open the app → **Set up sync** (top bar).
2. **First phone:** paste the Worker URL, tap **Generate a code**, tap **Connect**.
   Then copy the **share code** it shows you and send it to the other phone.
3. **Second phone:** open the app → **Set up sync** → paste the **share code** into
   the top box → **Use share code** → **Connect**.

Both phones now stay in sync — bookmarks, itinerary, day notes, and the booking
checklist. Changes show up within a few seconds while the app is open.

## Good to know
- **It's the trip code, not a login.** Keep it private; regenerate a new code
  anytime (tap Generate → Connect) to cut off old access.
- **Last edit wins.** If you both change the *same thing* within a few seconds,
  the most recent save is kept. Editing different things is fine.
- **Free tier is plenty** for two phones (well under Cloudflare's daily limits).
- Sync needs internet; offline edits push up automatically next time you're online.
