# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git is off limits without an explicit request

**Never run a git command that changes state unless the user has formally asked for it in that message.** This covers `commit`, `add`, `rm`, `mv`, `restore`, `checkout`, `switch`, `branch`, `reset`, `stash`, `merge`, `rebase`, `push`, `tag` — anything touching the index, the working tree or a remote. "Do the work" is never implicit permission to stage or commit it.

Read-only inspection (`status`, `log`, `diff`, `show`) is fine at any time.

Deleting a file the user asked you to delete is done with `rm`, not `git rm`: the removal belongs in the working tree, and staging it is the user's decision. Leave the changes there and say what is pending — the user reviews and commits.

## What this is

Thomas Poissonnier's personal portfolio, published with GitHub Pages at `poissonnierthomas.github.io`. Static site, no build step, no package manager, no framework — plain HTML/CSS/JS served as-is.

The site was rebuilt from scratch in 2026. The previous Bootstrap "Freelancer" version (`index-v1.html`, `css/styles.css`, `js/scripts.js`, `js/i18n-v1.js`) was kept as a rollback for a while, then deleted — git history holds it if it is ever needed again. Nothing constrains `i18n/*.json` any more: keys may be renamed or removed, as long as every reference is updated with them.

## Running locally

No dev server, no build command. Serve the directory over HTTP:

```bash
python3 -m http.server 8000
```

HTTP rather than `file://` is mandatory, not a preference: `js/layout.js` fetches `partials/*.html`, `js/render.js` fetches `data/*.json`, `js/i18n.js` fetches `i18n/*.json`, and `<use href="assets/icons.svg#…">` resolves an external document. All four are blocked from a `file://` origin.

`python3 -m http.server` answers `304 Not Modified`, so an edited ES module can be served from cache and a page silently keeps running old code. If a change appears to have no effect, force-reload before debugging.

There is no test suite or linter. There is one check, and it covers translations, data cross-references and asset paths:

```bash
python3 outils/verifier.py
```

It exits non-zero on the first inconsistency and runs in CI on every push and pull request (`.github/workflows/verification.yml`). Standard library only, no venv, no dependency to install — so it stays runnable by hand.

Run it after touching `i18n/*.json`, `data/*.json`, or anything under `assets/`. What it catches:

- **Translation keys** — the two locales must declare the same key set, and every key referenced by a page or a data file must exist. Keys present in the JSON but referenced nowhere are not reported: they are harmless leftovers from earlier redesigns, and now safe to prune.
- **Data cross-references** — the data files cite each other by string and nothing enforces it at runtime. An unclassified techno still shows on the project card but never appears in the filter panel; it fails silently, which is the whole reason this check exists. Also covers unknown contexts, unknown skill technos, project ids cited but absent, and aliases straddling two categories.
- **Files** — every icon must exist in the sprite, and every `assets/…` path quoted anywhere must resolve on disk. Several asset paths contain spaces and accents, so the check bounds paths at the quote, never at whitespace.

Adding a check means editing `outils/verifier.py`; keep it dependency-free.

## The English stub

`index-en.html` is a 9-line stub: it writes `localStorage['portfolio-lang'] = 'en'` and redirects to `index.html`. It still works with the current version, which reads the same storage key. Never add content there.

## Architecture

**Three layers, deliberately separated so the rendering technology can be swapped:**

- **data** — `data/*.json`, plain flat JSON, `json_decode`-compatible
- **templates** — `<template>` elements at the bottom of each page, containing real markup
- **engine** — `js/render.js`, the only disposable piece

A move to PHP means replacing the loops in `render.js` with `foreach` over the same JSON, reusing the `<template>` markup as-is. The CSS is unaffected — it only knows classes. `js/layout.js` becomes two `include()`. This is why data and markup are never generated inside JavaScript strings.

**Pages.** Four real pages sharing one header and one footer:

| File | `<body data-page>` | Content |
|---|---|---|
| `index.html` | `index` | hero, profil (timeline + narrative + two blocks), interests, CV |
| `projets.html` | `projets` | faceted filter panel, project grid, GitHub call-to-action, 9 `<dialog>` |
| `competences.html` | `competences` | skills by group, expertises, soft skills, context legend, 9 `<dialog>` |
| `contact.html` | `contact` | coordinates only |

`js/layout.js` fetches `partials/header.html` and `partials/footer.html` into `#zone-entete` / `#zone-pied`, marks the active nav entry with `aria-current="page"` from `data-page`, and wires the burger menu and the header scroll state.

**Boot order is load-bearing** (`js/app.js`):

```
Promise.all([ monterLayout(page), rendre(page), charger(langueCourante()) ])
                              ↓
                definirLangue(langueCourante())
```

The three loads are independent — the layout targets `#zone-entete` / `#zone-pied`, the render targets containers already in the page, and translations target nothing until applied — so they run as one wave rather than three. What is *not* negotiable is the arrow: applying translations before rendering would leave every data-driven block in French. This is the only temporal coupling in the site.

`charger()` inside the `Promise.all` only warms the cache; `definirLangue()` reads it back with no second fetch. Both `charger()` in `i18n.js` and `donnees()` in `render.js` cache the *promise*, not the result, so concurrent callers share one request — that is what stops `competences.html` from fetching `projets.json` twice. A rejected promise is evicted so a later call can retry. Consequence to keep in mind: every caller receives **the same parsed object**, so no rendering code may mutate what `donnees()` returns.

**The page is hidden while all this runs.** A synchronous script in each `<head>` sets `data-chargement` on `<html>`, and `css/main.css` hides the body while it is there; `js/app.js` removes it once rendered and translated, whether it succeeded or failed. Without it an English-language visitor sees French for a beat, then a visible swap. Two things must stay true: the script stays **synchronous and in `<head>`** (deferred, it would hide *after* a first paint — the very flicker it exists to prevent), and the masking is done **by the script, never by the stylesheet alone**, so a visitor without JavaScript still sees the page. A 3-second `setTimeout` unhides regardless, so a module that never boots cannot leave a blank page behind. On failure `js/app.js` sets `data-pret="erreur"`, which draws a bilingual banner from CSS alone — no markup needed, since the failure may well be that nothing was injected.

**Template filling convention**, read by `remplir()` in `render.js`:

```
data-s="field"            → textContent (literal value)
data-s-i18n="field"       → sets data-i18n  (the value is a key)
data-s-i18n-html="field"  → sets data-i18n-html
data-s-attr="attr:field"  → setAttribute (comma-separated pairs allowed)
```

**i18n** (`js/i18n.js` + `i18n/{fr,en}.json`, 239 keys each): the DOM is rewritten after load rather than serving separate pages.

```
data-i18n="key"            → textContent
data-i18n-html="key"       → innerHTML (translations containing <b>, <p>, <br>)
data-i18n-attr="attr:key"  → arbitrary attribute, comma-separated pairs
data-i18n-href="key"       → href (the CV links differ per language)
```

`appliquer(t, root)` accepts a subtree, which is how injected content gets translated. Meta tags carry no data attribute and are patched by name in `appliquerMeta()` — a new meta tag needs an explicit line there. Choice persists in `localStorage['portfolio-lang']`, default `fr`.

New visible text means a new key in **both** locale files.

## Data files

**`data/projets.json`** — 9 projects, in display order; the card number is the array index, so reordering renumbers the grid.

```json
{
  "id": "keyp",
  "icone": "shield",
  "annee": "projet.annee.2",
  "technos": ["Java", "JavaFX", "Cryptographie", "MVC", "Design Patterns"],
  "carte":  { "titre": "…", "description": "…", "image": "…", "alt": "…" },
  "tags":   ["card8.badge1", { "libelle": "Dijkstra" }],
  "detail": { "titre": "…", "description": "…", "html": true,
              "images": [ … ], "liens": [ … ] }
}
```

- `technos` are **literal names**, shown as-is on the card and used by the filter panel. `carte.*` and `detail.*` are **i18n keys**.
- `tags` are the fiche's competency labels and accept two forms: a string is an i18n key, `{ "libelle": "…" }` is a literal (proper nouns such as Dijkstra have no place in a translation file).
- A project shows the "public repository" marker when any `detail.liens` entry has `"externe": true` — it is derived, not stored twice. Link icons are derived from the same flag; the entry carries no `icone` field.

**`data/facettes.json`** — the filter panel. `facettes` lists the groups in display order; `source` says where the values come from (`techno`, `annee`, `code`), each handled by the `SOURCES` table in `render.js`. Adding a facet drawn from an existing field costs one JSON entry plus one entry there. `technos` maps every technology to a category; the rule for that mapping is proper noun (a named product or standard) → `outil`, common noun (a field of practice) → `sujet`, which is what puts Qt, UML and Symfony on one side, "API web" and "Base de données" on the other.

Two escape hatches, both deliberate — a technology's presence on a card and its presence in the filter panel are separate decisions:

- **`"hors-filtre"`** as a category keeps the technology on the project card but out of every facet. It matches no facet's `categorie`, so it silently drops out of the panel. Use it for values that carry information on a card yet make useless filters — a filter that selects a single project narrows nothing. Webpack, MVC and Design Patterns are on it. Do **not** achieve this by deleting the key from `technos`: the coherence check below would then report it as unclassified forever.
- **`alias`** merges several technologies into one filter entry. `SOURCES.techno` maps each value through it and de-duplicates, and because the same function both builds the options and tests membership, ticking the merged entry matches every underlying technology. Cards keep showing the real name — Keyp still reads "JavaFX" while the panel offers "Qt / JavaFX". Aliased technologies must share the same category, otherwise the merged entry appears once per facet they span.

Filtering semantics: **OR within a facet, AND across facets**.

**`data/competences.json`** — `groupes` (languages, tools), `contextes`, `expertises`, `savoirEtre`. A skill lists `technos`, which resolve to the projects using them; it may also carry an explicit `projets` array of project ids, for a cross-cutting skill no project technology names — `Git` is on it, pointing at the five projects whose repository is public. Both sources are merged by `projetsDe()`. There is deliberately **no skill level**: a self-declared level is unverifiable, so each skill carries `contextes` (where it is actually used, one or more) and `technos` (which resolve to the projects that prove it). Rows are sorted by best context, then by project count. Only contexts actually in use appear in the legend.

**`data/parcours.json`** — timeline steps. `actuel: true` gives an accent-filled dot and an accent year.

**`data/interets.json`** — three entries. An entry may carry `image`, `alt`, `legende` (a literal — a club name is a proper noun) and `role` (an i18n key), which render as a logo block at the bottom of the card. That block drives the layout: `render.js` tags an entry that has an `image` with `interet--large`, which spans two rows of the two-column grid, so the long entry gets a wide column and the short ones stack beside it instead of inheriting its height. **The layout assumes exactly one entry with an image** — give a second one an image and the grid loses its balance. Entries without an image have the whole block removed, so they are unaffected.

## Styling (`css/main.css`, ~1190 lines)

Dark theme declared once as custom properties in `:root`, alongside a small typographic scale. Change the palette there, not at the call site. The file opens with block `0. Polices` — six `@font-face` — then continues as a sequence of 17 numbered `/* --- n. Title --- */` blocks in page order; locate the right block before adding rules.

Comments were deliberately stripped to a minimum. The five that remain flag rules that look removable and are not — remove one and something breaks:

- `[hidden] { display: none !important }` — `hidden` comes from the UA stylesheet and loses to any author `display`; without it the project filter hides nothing.
- `.fiche { margin: auto }` — the reset `* { margin: 0 }` kills the native centring of a modal `<dialog>`.
- `.fiche[open] { display: flex }` — the `[open]` is mandatory, otherwise it overrides the `display: none` of closed dialogs and all seven stack at the bottom of the page.
- `.fiche-corps { min-height: 0 }` — a flex item refuses to shrink below its content otherwise, and the body never scrolls.
- `.grille-filets > *` — the 1px rules are drawn by each cell rather than by the container background, so a missing cell (odd count, or filtering) draws nothing instead of a grey square.

## Conventions worth knowing

- Native `<dialog>` + `showModal()` for project fiches, native `<details>` for the timeline narrative. No JavaScript re-implements what the browser already does.
- Identifiers, class names and data fields are in French; the code reads as one language.
- Section ids: `#accueil`, `#profil`, `#interets-section`, `#cv`, `#competences`, `#contact`.
- Assets live under `assets/img/portfolio/<project-name>/`. Several directory names contain accents or spaces and are referenced unencoded; keep that convention rather than mixing in percent-encoded paths. `.gitignore` excludes `*.zip`.
- `assets/icons.svg` is a sprite of 26 stroke symbols, viewBox 24×24, `stroke="currentColor"`.
- **Every displayed image is WebP**, sized to its real use (card thumbnails 900px wide, fiche illustrations 1600px, portrait 960px, interest logos 400px) — roughly twice the CSS width, for high-density screens. A new image goes through the same treatment; dropping in a 2 MB PNG undoes the work. The two CV files are the exception: `cv.href.png` and `cv.href.pdf` point at the full-resolution originals because the buttons *download* them, and `cv.apercu.src` points at a separate lightweight WebP used only for the on-page preview. Do not merge the two back together.
- **No external requests.** Fonts are self-hosted under `assets/fonts/` and declared in block 0 of `css/main.css` — DM Sans as a variable font covering weights 300-500, Instrument Serif in roman and italic, each split latin / latin-ext. `index.html` and its three siblings preload the two `latin` files. Keep it that way: a CDN link costs a third-party round trip before first paint and sends the visitor's IP to that host.

## Deployment

`origin` **is** the GitHub Pages repository (`github.com/PoissonnierThomas/PoissonnierThomas.github.io.git`). Pushing `main` publishes the site directly — there is no separate build or publish step.

The nested `PoissonnierThomas.github.io/` directory is not a publishing target: it is an abandoned clone of that same remote, with an empty working tree and no local commits. Ignore it.

Untracked `mockup-*.html` files at the root are standalone design explorations, not part of the site.
