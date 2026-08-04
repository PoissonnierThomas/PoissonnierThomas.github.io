/* Pré-rendu du site.
 *
 * Le HTML servi par les pages sources est vide : tout le contenu est injecté
 * par js/render.js une fois la page chargée. Un moteur de recherche qui
 * n'exécute pas JavaScript n'y voit donc rien.
 *
 * Plutôt que de réécrire la logique de rendu ici — deux implémentations qui
 * divergeraient à la première évolution — ce script pilote un vrai navigateur :
 * il charge chaque page, laisse le site se construire comme chez un visiteur,
 * puis sérialise le DOM obtenu. Ce qui est publié est donc, par construction,
 * ce que le navigateur produit.
 *
 *     npm run build     →  dist/
 *
 * Les pages sources restent parfaitement fonctionnelles sans ce build ; elles
 * rendent simplement côté client, ce qui reste pratique en développement.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { servir } from './serveur.js';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SORTIE = path.join(RACINE, 'dist');
const DOMAINE = 'https://poissonnierthomas.github.io';

const PAGES = ['index.html', 'projets.html', 'competences.html', 'contact.html'];
const LANGUES = ['fr', 'en'];
const DEFAUT = 'fr';

// recopiés tels quels ; data/ et i18n/ n'en sont pas, le HTML livré les a déjà
// consommés et plus aucun fetch ne part une fois la page pré-rendue.
// `demos` contient des applications déjà compilées, servies telles quelles :
// elles ne passent pas par le pré-rendu et ne doivent surtout pas être ouvertes
// dans Chromium comme les pages du site.
const A_COPIER = ['assets', 'css', 'js', 'robots.txt', 'demos'];

/* --- Chemins ------------------------------------------------------------- */

// où atterrit une page donnée, dans une langue donnée
const cheminDe = (page, langue) =>
  (langue === DEFAUT ? '/' : `/${langue}/`) + (page === 'index.html' ? '' : page);

const urlDe = (page, langue) => DOMAINE + cheminDe(page, langue);

/* --- Transformation du DOM ----------------------------------------------- */

/* Exécuté dans la page, une fois le rendu terminé. Tout ce qui suit ne peut
   pas se faire après coup sur du texte : il faut le DOM pour viser juste. */
function transformer({ page, langue, langues, defaut, domaine, liens }) {
  const doc = document;

  doc.body.dataset.prerendu = 'true';
  delete doc.body.dataset.pret;

  // Les gabarits ont fait leur office : plus rien ne les lira, et leur contenu
  // échappe à tout querySelectorAll (il vit dans un fragment à part), donc les
  // réécritures de chemins ci-dessous ne les atteindraient pas.
  doc.querySelectorAll('template').forEach((t) => t.remove());

  // le voile anti-clignotement n'a plus d'objet : le HTML livré est déjà
  // traduit, le masquer ne ferait que retarder l'affichage
  doc.querySelectorAll('head script:not([src])').forEach((s) => {
    if (s.textContent.includes('data-chargement') || s.textContent.includes('dataset.chargement')) {
      s.remove();
    }
  });
  delete doc.documentElement.dataset.chargement;

  const racine = langue === defaut ? '' : '..';
  const versRacine = (chemin) => (racine ? `${racine}/${chemin}` : chemin);

  // Les pages non françaises vivent dans /en/ : tout chemin relatif doit
  // remonter d'un cran, sans quoi il viserait /en/assets/…
  if (racine) {
    const attributs = ['src', 'href'];
    doc.querySelectorAll('[src], [href]').forEach((el) => {
      attributs.forEach((attr) => {
        const v = el.getAttribute(attr);
        if (!v) return;
        if (/^(https?:|mailto:|tel:|data:|#|\/)/.test(v)) return;
        if (/^(assets|css|js|data|i18n|partials)\//.test(v)) el.setAttribute(attr, versRacine(v));
      });
    });
    // <use href="assets/icons.svg#…"> vit dans l'espace de noms SVG
    doc.querySelectorAll('use').forEach((u) => {
      const v = u.getAttribute('href');
      if (v && /^assets\//.test(v)) u.setAttribute('href', versRacine(v));
    });
  }

  // Navigation : chaque entrée pointe vers la page de la langue courante
  doc.querySelectorAll('.nav a[data-page]').forEach((a) => {
    a.setAttribute('href', liens[langue][a.dataset.page]);
  });
  const marque = doc.querySelector('.marque');
  if (marque) marque.setAttribute('href', liens[langue].index);
  doc.querySelectorAll('a[href="index.html"], a[href="projets.html"], a[href="contact.html"], a[href="competences.html"]')
    .forEach((a) => {
      const cle = a.getAttribute('href').replace('.html', '');
      if (liens[langue][cle]) a.setAttribute('href', liens[langue][cle]);
    });

  // Le sélecteur de langue devient un jeu de liens : sans JavaScript il
  // fonctionne encore, et chaque langue a désormais une adresse propre.
  const boite = doc.querySelector('.langues');
  if (boite) {
    boite.querySelectorAll('[data-lang]').forEach((bouton) => {
      const cible = bouton.dataset.lang;
      const lien = doc.createElement('a');
      lien.setAttribute('href', liens[cible][page.replace('.html', '')]);
      lien.setAttribute('hreflang', cible);
      lien.textContent = bouton.textContent;
      if (bouton.hasAttribute('title')) lien.setAttribute('title', bouton.getAttribute('title'));
      if (cible === langue) lien.setAttribute('aria-current', 'true');
      bouton.replaceWith(lien);
    });
  }

  // canonique et alternats : sans eux, les deux langues se font concurrence
  const tete = doc.head;
  const poser = (rel, attrs) => {
    const l = doc.createElement('link');
    l.setAttribute('rel', rel);
    Object.entries(attrs).forEach(([k, v]) => l.setAttribute(k, v));
    tete.appendChild(l);
  };
  const url = (lg) => domaine + (lg === defaut ? '/' : `/${lg}/`) + (page === 'index.html' ? '' : page);
  poser('canonical', { href: url(langue) });
  langues.forEach((lg) => poser('alternate', { hreflang: lg, href: url(lg) }));
  poser('alternate', { hreflang: 'x-default', href: url(defaut) });

  const og = doc.querySelector('meta[property="og:url"]');
  if (og) og.setAttribute('content', url(langue));
  const ogLocale = doc.createElement('meta');
  ogLocale.setAttribute('property', 'og:locale');
  ogLocale.setAttribute('content', langue === 'fr' ? 'fr_FR' : 'en_US');
  tete.appendChild(ogLocale);
}

/* --- Construction -------------------------------------------------------- */

async function copier(nom) {
  await fs.cp(path.join(RACINE, nom), path.join(SORTIE, nom), { recursive: true });
}

async function construire() {
  const { base, fermer } = await servir(RACINE);

  await fs.rm(SORTIE, { recursive: true, force: true });
  await fs.mkdir(SORTIE, { recursive: true });

  // table des liens : langue → page → chemin publié
  const liens = Object.fromEntries(LANGUES.map((lg) => [
    lg, Object.fromEntries(PAGES.map((p) => [p.replace('.html', ''), cheminDe(p, lg)])),
  ]));

  const navigateur = await puppeteer.launch({ args: ['--no-sandbox'] });
  let ecrites = 0;

  for (const langue of LANGUES) {
    for (const nomPage of PAGES) {
      const onglet = await navigateur.newPage();
      const soucis = [];
      onglet.on('pageerror', (e) => soucis.push(String(e.message)));
      onglet.on('requestfailed', (r) => soucis.push(`requête échouée ${r.url()}`));
      onglet.on('response', (r) => {
        if (r.status() >= 400) soucis.push(`HTTP ${r.status()} ${r.url()}`);
      });

      // la locale doit être posée avant que la page ne démarre
      await onglet.goto(`${base}/${nomPage}`, { waitUntil: 'domcontentloaded' });
      await onglet.evaluate((lg) => localStorage.setItem('portfolio-lang', lg), langue);
      await onglet.goto(`${base}/${nomPage}`, { waitUntil: 'networkidle0' });
      await onglet.waitForFunction(() => document.body.dataset.pret === 'true', { timeout: 30000 });

      await onglet.evaluate(transformer, {
        page: nomPage, langue, langues: LANGUES, defaut: DEFAUT, domaine: DOMAINE, liens,
      });

      const html = await onglet.evaluate(() =>
        '<!DOCTYPE html>\n' + document.documentElement.outerHTML);

      const dest = path.join(SORTIE, langue === DEFAUT ? '' : langue, nomPage);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, html, 'utf-8');
      ecrites++;

      const taille = (html.length / 1024).toFixed(0);
      console.log(`  ${langue}/${nomPage.padEnd(18)} ${taille.padStart(4)} Ko`
        + (soucis.length ? `   ⚠ ${soucis.slice(0, 2).join(' | ')}` : ''));
      if (soucis.length) process.exitCode = 1;
      await onglet.close();
    }
  }

  await navigateur.close();
  await fermer();

  for (const nom of A_COPIER) await copier(nom);

  // Sitemap engendré à partir des mêmes constantes que les pages : il ne peut
  // pas se désynchroniser, là où la version tenue à la main l'aurait fait à la
  // première page ajoutée. Les alternats hreflang y sont répétés, comme le
  // demande Google pour un site multilingue.
  const jour = new Date().toISOString().slice(0, 10);
  const entrees = LANGUES.flatMap((langue) => PAGES.map((p) => {
    const alternats = [...LANGUES.map((lg) => [lg, urlDe(p, lg)]),
                       ['x-default', urlDe(p, DEFAUT)]]
      .map(([lg, href]) => `    <xhtml:link rel="alternate" hreflang="${lg}" href="${href}"/>`)
      .join('\n');
    return `  <url>
    <loc>${urlDe(p, langue)}</loc>
    <lastmod>${jour}</lastmod>
${alternats}
  </url>`;
  })).join('\n');

  await fs.writeFile(path.join(SORTIE, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<!-- Engendré par outils/construire.js — ne pas modifier à la main. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entrees}
</urlset>
`, 'utf-8');

  // l'ancien stub anglais reposait sur localStorage ; il pointe maintenant
  // vers la vraie adresse
  await fs.writeFile(path.join(SORTIE, 'index-en.html'),
    `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Redirecting…</title>
<link rel="canonical" href="${DOMAINE}/en/">
<meta http-equiv="refresh" content="0; url=/en/">
<meta name="robots" content="noindex">
</head>
<body><a href="/en/">English version</a></body>
</html>
`, 'utf-8');

  console.log(`\n${ecrites} pages écrites dans dist/`);
}

construire().catch((err) => {
  console.error('build interrompu :', err);
  process.exit(1);
});
