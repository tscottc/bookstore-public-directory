# John K. King Bookstore — Public Directory & FAQ

An interactive web app for [John K. King Used & Rare Books](https://www.johnkingbooks.com/) — a legendary four-story independent bookstore in Detroit, Michigan. The app lets customers search for book subjects by floor, browse a FAQ, and submit feedback, all without a build step or backend.

---

## What It Does

- **Directory search** — Find where a book subject is shelved, with optional floor filtering
- **FAQ** — Browse and search common questions about the store
- **Feedback** — Submit suggestions via an embedded Google Form
- **Help / Privacy Policy** — Accessible via a fixed "?" button in the corner

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
│   ├── app.js         # All application logic (~496 lines)
│   ├── style.css      # All styles (~640 lines)
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

Search is entirely client-side via **Fuse.js** — no server involved.

### Directory search
- Fuzzy matches against `SUBJECT` (70% weight) and `KEYWORDS` (30% weight)
- Optional floor dropdown filter (AND logic with text search)
- Threshold `0.2`, `ignoreLocation: true`, `ignoreFieldNorm: true` for balanced relevance

### FAQ search
- Fuzzy matches against `Question` (60%), `Keywords` (50%), `Answer` (30%)
- Same Fuse.js configuration

Both searches support typos and partial matches. Results update on Enter or button click.

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

## Analytics

- **Google Tag Manager** (`GTM-TFQGXWFC`) — injected in `<head>` and `<body>` per GTM spec
- **Google Analytics 4** (`G-X0YDN3XTEW`) — loaded via GTM

### Custom dataLayer events

| Event | Trigger | Parameters |
|-------|---------|------------|
| `site_search` | Enter key or search button click (non-empty query only) | `search_term`, `search_location` (`'directory'` or `'faq'`) |

The push fires once per submitted search — not on every keystroke — giving one clean event per actual search interaction.

No analytics configuration is needed for local development.

---

## Browser Compatibility

Works in any modern browser (Chrome, Firefox, Safari, Edge). No polyfills are used; the app relies on standard ES6+ features (`fetch`, `async/await`, arrow functions, template literals).

---

## About the Bookstore

John K. King Used & Rare Books has operated in Detroit since 1971. The main store at 901 W. Lafayette Blvd occupies a four-story building with hundreds of thousands of books organized by subject across floors. This directory helps customers navigate that collection.
