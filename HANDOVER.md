# City Guide: Paris — handover

Welcome! This is a small web app: an illustrated map of Paris where people share their favourite places and build **walking guides** ("itineraries") out of them. You can run it in two minutes, with no account and no setup.

## What the app does

- **Home** (`/`): a landing page with the title and three buttons.
- **Map** (`/map`): every place as a pin, filtered by category. Selecting a pin shows its photo and description.
- **Guides** (`/guides`): themed guides made by users. Each guide (`/guides/:id`) shows its places as numbered stops on a map, joined by a walking route, with the **walking time and distance** of each leg, the total, and a few simple directions.
- **About us** (`/about`): a text page the admin can edit.
- **Accounts**: anyone can sign up, search a place to add it to the map, and create guides. You can only edit what **you** created. The **admin** (the project owner) can edit everything.
- **Comments**: a guestbook at the bottom of the map page.

## Run it

```
npm install
npm run dev
```

Open the address Vite prints. With no `.env` file, the app runs in **local mode**: everything is stored in your browser (`localStorage`) and there is no login: you are allowed to do everything. That is all you need for most work.

The real version uses **Supabase** (database, login, photo storage), **MapTiler** (map tiles and place search) and a free public **OSRM** server (walking routes). Their keys live in a `.env` file that is **not** in git. Ask the owner if you need them, and **never commit `.env`**.

## How it is built

React 18 + Vite, plain JavaScript, no UI library, no TypeScript. Pages use a **hash router**, so links look like `/#/guides/123` and work on any static host.

| You want to… | Look at |
|---|---|
| see all routes | `src/App.jsx` (pages in `src/pages/`, loaded on demand through `src/pages/lazy.js`) |
| read or write data | `src/api.js`: **the only file that talks to the database**. Every function works with Supabase or with `localStorage` (`src/storage.js`) |
| know who may do what | `src/auth.jsx`: `canContribute` (signed in), `canManage(ownerId)` (made it, or admin), `isAdmin` |
| guides, their places and order | `src/guides.jsx` (shared state) and `src/pages/GuidePage.jsx` |
| walking times and directions | `src/routing.js`, `src/useRoute.js` |
| the map | `src/components/PlaceMap.jsx` (Leaflet) and `src/duotone.js` (tile colours) |
| place search | `src/geocode.js`, `src/maptiler.js` |
| the database | `supabase/migrations/*.sql` |
| colours and look | `src/styles/app.css` |

More detail is in `README.md`.

## Things worth knowing

- **The database enforces the rules**, not just the buttons (row-level security in the migrations). Hiding a button is never enough protection.
- **Never edit a migration that was already applied**: add a new file in `supabase/migrations/`.
- **Style**: flat cartoon look. Ink `#0e2a2e`, cream `#f3ead3`, green `#2f8f74`, 3 px ink borders, hard offset shadows (no blur), uppercase buttons. Reuse the existing classes (`.btn`, `.btn-secondary`, `.guide-card`…) before inventing new ones.
- The site texts are in **English**.
- `CHECKLIST.md` lists what to test by hand before going live.
- Work on a **git branch**, and check `npm run build` passes before you commit.

## Your feature: "Copy the link of a guide"

**Goal.** A visitor reading a guide can copy its address with one click, to send it to a friend.

**Why this one.** It is small, visible and self-contained: one component, no database change, and it touches the real routing and styling of the app.

**What to build**
1. On the guide page (`src/pages/GuidePage.jsx`), next to the title area, add a **"Copy link"** button, visible to **everyone** (not only editors).
2. On click, copy the guide's address (`window.location.href`: the hash router already makes it unique per guide) to the clipboard with `navigator.clipboard.writeText`.
3. Show feedback: the button text changes to **"Link copied ✓"** for about two seconds, then goes back.
4. If copying fails or the clipboard is unavailable, show the address in a prompt or a selectable field so the user can copy it by hand. Handle it without crashing.
5. Style it with the existing button classes so it matches the app.

**Done when**
- it works on the guide page for a visitor and for a signed-in user;
- the copied link opens the same guide when pasted in a new tab;
- `npm run build` passes and there are no errors in the browser console;
- you tested it in local mode and on a narrow (phone-sized) window.

**Stretch goals** (only if you finish early)
- On phones, use the Web Share API (`navigator.share`) when it exists, and fall back to copying.
- Add the same button to each guide card on the Guides page.
- Add an "Open in Google Maps" link for each place (a URL built from its latitude and longitude).

Have fun, and ask the owner if anything is unclear.
