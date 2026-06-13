# 🇰🇷 Korea Family Trip Planner

A mobile-first, no-build static web app for planning a family trip to **Seoul & Busan**. Browse activities, filter them, flip a "rainy day" switch, bookmark favourites, tick off bookings, and see everything on a map. Works **offline** once loaded.

## Run it locally

Because the app `fetch`es `activities.json` and registers a service worker, opening `index.html` directly with `file://` won't work — you need a tiny local server:

```bash
# Python (already on most machines)
python -m http.server 8000
# then open http://localhost:8000
```

## Edit your activities

Everything lives in **`activities.json`** — just edit that file. Each entry:

```json
{
  "name": "Lotte World",
  "city": "Seoul",                 // Seoul or Busan
  "categories": ["theme park"],     // free-text tags, shown as badges
  "weatherProof": true,             // true = fine in rain
  "indoor": true,
  "forWhom": "family",              // family | kids | mum | dad
  "needsBooking": true,             // shows up in the Booking ✓ tab
  "bookingLead": "Book 1–2 days ahead",
  "notes": "Short description.",
  "lat": 37.5111, "lng": 127.0980   // for the Map tab
}
```

## Files

| File | What it does |
|------|--------------|
| `index.html` | Page shell: header, rainy toggle, tabs, filters, views |
| `styles.css` | All styling (dark theme, mobile-first) |
| `app.js` | Loads data, filtering, bookmarks, checklist, map, offline |
| `activities.json` | **Your data** — edit this |
| `sw.js` | Service worker for offline use |
| `.github/workflows/deploy.yml` | Auto-deploys to GitHub Pages on push to `main` |

## Deploy to GitHub Pages

1. Push these files to a GitHub repo (root of the repo).
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main`. The included workflow publishes the site and gives you the URL.

> Notes & bookmarks are saved in your browser's `localStorage` (this device only). The map needs internet; everything else works offline.
