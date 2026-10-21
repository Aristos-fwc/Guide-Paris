# City Guide: Paris

React + Vite front end built from the Claude Design file "Paris Guide Map v2".

## Run

Requires Node.js 18+.

```
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173). With no configuration the app
works locally: places, photos, guides and comments are stored in your browser only, and editing
is open (no login needed) since the data is yours alone.

## Shared storage and owner login (Supabase)

Visitors can read everything and post comments. **Anyone with an account** can create their own
guides and add places to the map, and can edit or delete only what they created. **You** (the
admin, listed in `site_owners`) can edit and delete everything, and are the only one who can add
categories. The database enforces this (row-level security), not just the interface.

Accounts have limits (20 guides and 100 places each, see `enforce_user_quota` in the migration).

**To let visitors sign up** (migration `20261020180000_user_guides.sql`, then the dashboard):
1. `npm run db:push` (or paste `supabase/schema.sql` in the SQL Editor).
2. Authentication > Sign In / Providers > Email: turn **on** "Allow new users to sign up", and keep
   "Confirm email" on so that fake addresses cannot be used.
3. Supabase's built-in email sender is limited to a few messages per hour. Before opening the site to
   the public, add your own SMTP server (Authentication > Emails > SMTP Settings).

### The database

Defined in `supabase/migrations/`:

| Table | What it holds |
|---|---|
| `places` | name, category, description, address, coordinates |
| `place_photos` | any number of photos per place; the first (lowest position) is the cover. Photos found on Wikimedia keep their author and licence |
| `categories` | Restaurants, Bars... A place references its category: renaming one updates every place, and one still in use cannot be deleted |
| `guides` | title and introduction |
| `guide_places` | which places are in which guide, and in what order |
| `comments` | the guestbook |
| `site_owners` | the email addresses allowed to edit (not readable through the API) |

Plus a public `place-images` bucket for uploaded photos (1 MB, images only).

### Create it on your Supabase project

Pick **one** of the two ways.

**A. With the Supabase command line (keeps a history of changes)**

```
npx supabase login
npx supabase link --project-ref YOUR-PROJECT-REF
npx supabase db push --dry-run          # shows what would be applied
npx supabase db push --include-seed     # applies it, with the starter places and guides
```

Your project ref is the part of the project URL before `.supabase.co`. `link` asks for the
database password chosen when the project was created (reset it in Project Settings > Database).

**B. Without the command line**

Open `supabase/schema.sql` (the migrations and starter data in one file), replace
`YOUR-EMAIL-HERE@example.com` at the very bottom with your email, then paste it all in the dashboard:
**SQL Editor > New query > Run**. Then skip the "owner" step below.

### Then, in the dashboard

1. **Create your account:** Authentication > Users > Add user. Enter your email and a password and
   tick **Auto Confirm User**.
2. **Sign-ups:** leave "Allow new users to sign up" off until you have applied every migration, then
   turn it on (see above).
3. **Make that account the owner** (way A only): put your email in `supabase/owner.example.sql`,
   paste it in the SQL Editor and run it. Until an address is listed, nobody can edit anything.
4. **Keys:** Project Settings > API (or "API Keys"): copy the **Project URL** and the
   **publishable** key (older projects call it "anon public"). Never use the secret /
   `service_role` key: everything prefixed `VITE_` ends up in the browser.
5. Copy `.env.example` to `.env`, fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, and
   restart `npm run dev`.

On Vercel or Netlify add the same variables in the site's environment settings and redeploy (they are
baked in at build time: with a manual upload of `dist`, put them in `.env` before `npm run build`).

### Changing the database later

```
npx supabase migration new add_something      # creates an empty, dated file in supabase/migrations/
# ...write your SQL in it...
npm run db:bundle                             # refreshes supabase/schema.sql
npx supabase db push                          # applies it to your project
```

Never edit a migration that was already pushed: add a new one.

**Editing the site:** click **Log in / Sign up** in the footer or the menu (`/#/login`). Once signed
in, the place search appears above the map, and **+ New guide** on the Guides page. Edit and Remove
only show on what you created (the admin sees them everywhere, and the admin-only *+ Add* category).
The footer shows your email, and "Admin" for the admin; click **Log out** when done.

## Comments

The guestbook at the bottom of the page lets visitors post a name (optional) and a message.
Anyone can read and post; nobody can edit or delete through the site. To moderate, open
Supabase > Table Editor > `comments` and delete the row. A hidden honeypot field filters
simple spam bots.

## About us page

Reached from the menu (`/#/about`). Everyone reads it; only the admin sees **Edit this page**, which
opens a title and a text field (a blank line starts a new paragraph). The text is stored in the
`site_pages` table (migration `20261020200000_site_pages.sql`: run it first, or saving will fail).
Until you write it, a short default text is shown.

## Guides page

The **Guides** tab under the map opens `/#/guides` with a cartoon iris transition (see
`src/transition.jsx`; it is skipped for visitors who prefer reduced motion). Pages use hash URLs
(`/#/guides`) so refreshing works on any static host with no redirect setup.

A guide is a title, its author's **pseudo** (free text, optional, remembered in the browser; run
migration `20261020190000_guide_authors.sql` for it), a short introduction and an **ordered list of
places from the map**: an itinerary. Each card on the Guides page opens the guide's page: a map
fitted to its places with numbered pins joined by the walking route, the walking time and distance
of each leg and in total, and the places in order with their photo and description.

Under each leg, a collapsible **Directions** list gives 3 to 6 short lines ("Head east · 370 m",
"Turn left, heading north-east · 720 m · via Rue d'Aboukir", ..., "Arrive at ..."). They are rebuilt
from the shape of the walk (the server's own turn-by-turn list is hundreds of tiny steps in Paris,
because pavements and crossings are mapped as separate paths), so they are good for orientation, not
for navigation; street names appear only where OpenStreetMap names the path.

Walking times come from the public OpenStreetMap routing server (OSRM, foot profile; see
`src/routing.js`). It is free and keyless but meant for light use: for a busy site, host your own OSRM
or switch to a paid routing API (change `ROUTER` in that file). If the server cannot be reached, the
page shows a rough estimate marked "≈" (straight line plus a detour allowance, at about 4.7 km/h).

The guide's creator (or the admin) builds it in three ways:
- **From the map:** the selected place shows an *In guides* row; one click on a guide adds the place
  to it, another click removes it.
- **When adding a place:** the new-place panel has an optional *Add to guides* row.
- **From the guide's page:** *Add a place to this guide* (any place already on the map), **drag the
  ⠿ handle** of a stop (or use the ↑ / ↓ buttons) to set the order of the itinerary, *Remove from
  guide*, and *Edit guide* for the title, pseudo and introduction.

Everyone else only reads: a place shows *Featured in* links to the guides that contain it. Deleting a
place removes it from its guides; deleting a guide leaves its places on the map.

## Adding a place

Signed-in users see the **Search a place to add…** field above the map. From 3 letters it
suggests places. Pick one and:

1. the place is marked on the map (a pulsing draft pin) and the map flies to it;
2. its photo appears in the side panel, with the author and licence;
3. you choose a category and **write the description yourself**: it is never filled in
   automatically. The name can be corrected too;
4. **Save place** publishes it. **Cancel** drops the draft. Nothing is public before you save.

A place already on the map (within 40 m) is selected instead of being added twice. Saved places can
be changed afterwards with **Edit** (name, category, description).

**Where suggestions come from, and what is kept.** The search only ever suggests *places*: no
streets, towns, postcodes or historical events (stations and neighbourhoods count as places).
- With a MapTiler key: points of interest in the Paris region (OpenStreetMap data): museums, bars,
  restaurants, shops, parks, monuments, churches and train / metro stations (Châtelet - Les Halles,
  Gare du Nord...), plus the named neighbourhoods of Paris (Les Halles, Montmartre, Le Marais...).
  Bus stops, metro entrances, parking, offices, hairdressers and flats are dropped (see
  `src/maptiler.js` to change the rules).
- Without a key: Wikipedia, which only knows notable places (museums, parks, monuments) and will not
  find a neighbourhood bar. Articles about events, attacks, exhibitions and organisations are filtered
  out, by keywords, so an odd one may occasionally slip through.

**Where photos come from.** Wikimedia Commons, which only holds freely licensed images. The photo
of the matching Wikipedia article (or Wikidata image) is used, and the author and licence are shown
under it with a link to the original file, as the licences require. If there is no photo that clearly
belongs to the place (a logo or a neighbour's picture is refused), none is shown, and you can upload
your own after saving; an uploaded photo replaces the automatic one and its credit. Automatic photos
are linked from Wikimedia, not copied to your storage.

## MapTiler: map tiles and place search

Create a free key at https://cloud.maptiler.com/ and set `VITE_MAPTILER_KEY` (locally in `.env`,
online in the host's environment settings). It enables:

- the map tiles (without it the public OpenStreetMap tiles are used, fine for light traffic only);
- place search for any address, bar or shop (see "Adding a place"); without it the search falls back
  to Wikipedia landmarks.

The key is visible in the browser, so restrict it to your site's domain in the MapTiler dashboard.

## Link previews and icons

`public/` holds the tab icon (`favicon.svg`, `favicon-32.png`), the iOS icon (`apple-touch-icon.png`)
and the image shown when the link is shared (`og-image.jpg`, 1200x630). Share previews need
absolute URLs, so set `VITE_SITE_URL` (for example `https://my-guide.netlify.app`) in the host's
environment settings before building; without it the preview tags that need the address are
left out rather than written wrongly.

## Hero image

The header uses `public/assets/paris-gargoyle.webp` (114 KB). The original 2 MB PNG is kept in
`source-assets/` and is not served. To change the picture, convert the new one to WebP
(quality about 80, for example at https://squoosh.app) and replace that file.

## Performance

Vendor code is split into separate files (react, supabase, leaflet), the Guides and Login pages
load on demand (Guides is prefetched when the browser is idle), and the map code loads after
the page has painted.

## Structure

- `source-assets/` — original artwork, not served
- `src/main.jsx` — router (hash), auth and transition providers
- `src/App.jsx` — routes: `/` map, `/guides`, `/login`
- `src/pages/` — MapPage, GuidesPage, LoginPage
- `src/auth.jsx` — owner session; `canEdit` is true for the owner (or always without Supabase)
- `src/transition.jsx` — the cartoon page transition
- `src/pages/lazy.js` — on-demand page loading; `src/useTitle.js` — per-page tab titles
- `src/api.js` — data layer: Supabase when configured, localStorage otherwise
- `src/geocode.js` — place suggestions (MapTiler, or Wikipedia without a key)
- `src/wikipedia.js` — Wikipedia search and name matching; `src/photo.js` — Commons photo + credit lookup
- `src/storage.js` — localStorage backend used when Supabase isn't configured
- `src/components/` — Hero, Toolbar, PlaceSearch, PlaceMap (Leaflet), PlaceDetail, ImageSlot,
  NewPlacePanel, Comments, GuidesTab, TransitionLink, Footer
- `src/styles/modernist.css` — the Modernist design-system tokens/components
- `src/styles/app.css` — this page's theme overrides and layout
- `supabase/migrations/` — the database, as dated SQL files (source of truth)
- `supabase/seed.sql` — starter categories, places and guides; `supabase/owner.example.sql` — who may edit
- `supabase/schema.sql` — generated by `npm run db:bundle`: everything above in one file to paste in the SQL Editor
- `supabase/config.toml` — Supabase command line settings
