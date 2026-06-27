# John K. King Bookstore — Public Directory & FAQ

An interactive web app for [John K. King Used & Rare Books](https://www.johnkingbooks.com/) — a legendary four-story independent bookstore in Detroit, Michigan. The app lets customers search for book subjects by floor, browse a FAQ, and submit feedback, all without a build step or backend.

---

## What It Does

- **Directory search** — Find where a book subject is shelved, with optional floor filtering
- **FAQ** — Browse and search common questions about the store
- **Feedback** — Submit suggestions via an embedded Google Form
- **Help modal** — Fixed "?" button opens a guide covering search usage, a directory key (P.B., H.C., End Cap, Case, Center), a floor orientation map (N/S/E/W anchored to building landmarks), store hours, contact info, and links to Feedback and Privacy Policy

Navigation is hash-based (`#directory`, `#faq`) so browser back/forward works naturally.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | Vanilla JavaScript (no framework) |
| Search | [Fuse.js](https://fusejs.io/) v7.0.0 (CDN) |
| Styling | Plain CSS3 — no preprocessor |
| Data | Google Sheets published as CSV |
| Hosting | Firebase Hosting |
| Analytics | Google Tag Manager + Google Analytics 4 |

No `npm`, no build step, no bundler. The entire app is three files: `index.html`, `app.js`, and `style.css`.

---

## Project Structure

```
bookstore-public-directory/
├── public/
│   ├── index.html     # Entry point — markup, nav, modals
│   ├── app.js         # All application logic (~518 lines)
│   ├── style.css      # All styles (~687 lines)
│   └── 404.html       # Firebase 404 fallback page
├── firebase.json      # Firebase hosting config (serves public/)
├── .firebaserc        # Firebase project: store-directory-3
└── .gitignore
```

---

## Running Locally

No install required. Serve the `public/` directory with any static file server:

```bash
# Option 1 — Node
npx http-server ./public

# Option 2 — Python
cd public && python -m http.server 8000

# Option 3 — Firebase CLI (matches production)
firebase serve
```

Then open `http://localhost:8000` (or whichever port the server prints).

> **Note:** The app fetches data from two Google Sheets CSV URLs at runtime. You need an internet connection for data to load, even locally.

---

## Data Sources

Data lives in Google Sheets and is fetched as published CSV on page load — no database, no API key required.

| Dataset | Columns |
|---------|---------|
| **Directory** | `SUBJECT`, `KEYWORDS`, `FLOOR`, *(others rendered as table columns)* |
| **FAQ** | `Question`, `Answer`, `Keywords`, `Category` (optional) |

To update the data, edit the Google Sheets directly. Changes reflect immediately for all users on the next page load.

---

## Search

### Directory search

Client-side staged search — no Fuse.js, no server.

**Stage 1 — substring (runs first, stops here if anything matches):**
- Word-boundary regex match of the query against `SUBJECT` (e.g. `"YA"` won't hit `"Myanmar"`)
- Substring match of the query against each `KEYWORDS` phrase unit (comma-split, not word-split — `"Narcotics anonymous"` stays one unit)
- Subject hits are ranked above keyword hits in the result list

**Stage 2 — Levenshtein fallback (only runs when Stage 1 returns nothing):**
- Full `SUBJECT` phrase vs. query: edit cap = 1 for phrases < 5 chars, 2 for longer
- Individual words within `SUBJECT` vs. query: edit cap fixed at 1 (tighter than above to avoid coincidental matches like `"histery"` → `"Mystery"`)
- Each `KEYWORDS` phrase unit vs. query: same edit cap as full-phrase

The `stage` that produced each match (`subject`, `keyword`, `subject+keyword`, `fuzzy`, or `no-match`) is included in the search log payload alongside query, result count, and source.

Optional floor dropdown filter applies on top of whichever stage matched (AND logic).

### FAQ search
- Fuzzy matches against `Question` (60%), `Keywords` (50%), `Answer` (30%) via Fuse.js
- Threshold `0.2`, `ignoreLocation: true`, `ignoreFieldNorm: true`

Results update on Enter or button click.

---

## Deployment

The app is hosted on Firebase Hosting under project `store-directory-3`.

```bash
# Deploy everything
firebase deploy

# Deploy hosting only
firebase deploy --only hosting:store-directory-3
```

Firebase is configured to serve the `public/` directory and ignore dotfiles and `firebase.json` itself.

---

## Key Behaviors

- **Lazy loading** — FAQ data is only fetched the first time a user clicks the FAQ tab
- **Accordion cards** — FAQ answers expand/collapse with a smooth CSS animation; only the clicked card opens
- **Event delegation** — FAQ accordion clicks use a single listener on the container, not per-card listeners
- **Mobile responsive** — Layout stacks below 768px; inputs and buttons go full-width; table scrolls horizontally

---

## Help Modal

The fixed `?` button (bottom-right corner) opens a scrollable modal with five sections:

| Section | Contents |
|---------|----------|
| About This Directory | What the search does, how to use it |
| Directory Key | P.B. (Paperback), H.C. (Hardcover), End Cap, Case, Center — plain-English definitions |
| Finding Your Way | N/S/E/W orientation anchored to building landmarks; note on Front/Rear/East/West directory terms |
| What This Does Not Do | No book/title/author search; direct to staff for specific items |
| Store Hours & Contact | Current hours, address, phone; links to Feedback form and Privacy Policy |

### Store hours (as of last update)

| Day | Hours |
|-----|-------|
| Monday | 11am – 4pm |
| Tuesday – Saturday | 9:30am – 5:30pm |
| Sunday | Closed |

> Verify current hours at [johnkingbooksdetroit.com](https://www.johnkingbooksdetroit.com) before updating.

---

## Analytics

- **Google Tag Manager** (`GTM-TFQGXWFC`) — injected in `<head>` and `<body>` per GTM spec
- **Google Analytics 4** (`G-X0YDN3XTEW`) — loaded via GTM

### Custom dataLayer events

| Event | Trigger | Parameters |
|-------|---------|------------|
| `site_search` | Enter key or search button click (non-empty query only) | `search_term`, `search_location` (`'directory'` or `'faq'`) |

The push fires once per submitted search — not on every keystroke — giving one clean event per actual search interaction.

### Search query logging

Every submitted search is also sent to a Google Apps Script endpoint (`SEARCH_LOG_URL` in `app.js`) via a fire-and-forget `POST`. The payload is `{ query, resultCount, source }`. Failures are silently swallowed — logging never blocks the UI. This log is separate from GA4 and provides a raw query history in a Google Sheet.

No analytics configuration is needed for local development.

---

## Browser Compatibility

Works in any modern browser (Chrome, Firefox, Safari, Edge). No polyfills are used; the app relies on standard ES6+ features (`fetch`, `async/await`, arrow functions, template literals).

---

## About the Bookstore

John K. King Used & Rare Books has operated in Detroit since 1971. The main store at 901 W. Lafayette Blvd occupies a four-story building with hundreds of thousands of books organized by subject across floors. This directory helps customers navigate that collection.
