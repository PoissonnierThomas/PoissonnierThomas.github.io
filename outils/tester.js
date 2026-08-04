/* Tests du site publié.
 *
 * outils/verifier.py contrôle la cohérence des fichiers ; il ne dit rien du
 * comportement d'une page une fois chargée. C'est ce trou que ce script comble,
 * en ouvrant dist/ dans un vrai navigateur.
 *
 *     npm run build && npm test
 *
 * Ce qui est vérifié tient à ce que le pré-rendu peut casser sans que rien ne
 * le signale : un rendu rejoué qui double le contenu, un fetch survivant vers
 * data/ (absent du site déployé, donc 404 en production alors que tout marche
 * en local), un filtre privé de ses attributs, une page anglaise restée en
 * français, des balises hreflang incohérentes. Le contenu sans JavaScript est
 * testé en dernier : c'est la raison d'être du pré-rendu.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { servir } from './serveur.js';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(RACINE, 'dist');
const DOMAINE = 'https://poissonnierthomas.github.io';

/* Comptes tirés de data/*.json : 9 projets, 6 étapes de parcours, 3 intérêts,
   14 compétences (6 langages + 8 outils), 5 expertises, 4 savoir-être. Codés
   en dur volontairement — les recalculer depuis les JSON reviendrait à tester
   le rendu contre lui-même. À corriger lorsqu'on ajoute une entrée. */
const ATTENDU = {
  'index.html': { parcours: 6, interets: 3 },
  'projets.html': { cartes: 9, fiches: 9 },
  'competences.html': { fiches: 9, competences: 14, expertises: 5, savoirEtre: 4 },
  'contact.html': { coordonnees: 5 },
};

let echecs = 0;
function verifier(nom, ok, detail) {
  if (!ok) echecs++;
  console.log(`${ok ? '  ✓' : '  ✗'} ${nom}`);
  if (detail && !ok) console.log(`      ${detail}`);
  else if (detail) console.log(`      ${detail}`);
}

async function mesurer(navigateur, url, { sansJs = false } = {}) {
  const page = await navigateur.newPage();
  if (sansJs) await page.setJavaScriptEnabled(false);

  const erreurs = [];
  const requetes = [];
  page.on('pageerror', (e) => erreurs.push(String(e.message)));
  page.on('requestfailed', (r) => erreurs.push(`requête échouée ${r.url()}`));
  page.on('response', (r) => {
    requetes.push(r.url());
    if (r.status() >= 400) erreurs.push(`HTTP ${r.status()} ${r.url()}`);
  });

  await page.goto(url, { waitUntil: sansJs ? 'domcontentloaded' : 'networkidle0' });

  const etat = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    prerendu: document.body.dataset.prerendu,
    titre: document.title,
    description: document.querySelector('meta[name="description"]')?.content,
    canonical: document.querySelector('link[rel=canonical]')?.getAttribute('href'),
    alternates: [...document.querySelectorAll('link[rel=alternate]')]
      .map((l) => [l.getAttribute('hreflang'), l.getAttribute('href')]),
    entete: !!document.querySelector('.entete'),
    pied: !!document.querySelector('#zone-pied *'),
    cartes: document.querySelectorAll('#projets .projet').length,
    fiches: document.querySelectorAll('dialog.fiche').length,
    parcours: document.querySelectorAll('#parcours li').length,
    interets: document.querySelectorAll('#interets .interet').length,
    competences: document.querySelectorAll('.comp-nom').length,
    expertises: document.querySelectorAll('#expertises .expertise').length,
    savoirEtre: document.querySelectorAll('#savoir-etre > *').length,
    coordonnees: document.querySelectorAll('.coordonnees li').length,
    gabarits: document.querySelectorAll('template').length,
    langues: [...document.querySelectorAll('.langues a')].map((a) => a.getAttribute('href')),
    // un h2 traduit sert de témoin : s'il est français sur /en/, la locale a raté
    temoin: document.querySelector('#profil h2, .section-tete h2')?.textContent,
  }));

  await page.close();
  return { etat, erreurs, requetes };
}

async function principal() {
  try {
    await fs.access(path.join(DIST, 'index.html'));
  } catch {
    console.error('dist/ est absent ou incomplet — lancer `npm run build` d\'abord.');
    process.exit(1);
  }

  const { base, fermer } = await servir(DIST);
  const navigateur = await puppeteer.launch({ args: ['--no-sandbox'] });

  for (const langue of ['fr', 'en']) {
    const prefixe = langue === 'fr' ? '' : '/en';
    console.log(`\n${langue.toUpperCase()}`);

    for (const [page, compte] of Object.entries(ATTENDU)) {
      const url = `${base}${prefixe}/${page}`;
      const { etat, erreurs, requetes } = await mesurer(navigateur, url);

      // 1. le contenu attendu est présent, et une seule fois
      const comptes = Object.entries(compte)
        .map(([cle, n]) => `${cle}=${etat[cle]}/${n}`).join(' ');
      const bonCompte = Object.entries(compte).every(([cle, n]) => etat[cle] === n);
      verifier(`${page} — contenu pré-rendu`, bonCompte && etat.entete && etat.pied,
        `${comptes} entête=${etat.entete} pied=${etat.pied}`);

      // 2. rien ne subsiste du mode client
      const fetchDonnees = requetes.filter((u) => /\/(data|i18n)\//.test(u));
      verifier(`${page} — ni erreur, ni gabarit, ni fetch de données`,
        !erreurs.length && etat.gabarits === 0 && fetchDonnees.length === 0
          && etat.prerendu === 'true',
        `erreurs=${erreurs.length} gabarits=${etat.gabarits} fetchJSON=${fetchDonnees.length}`
          + (erreurs.length ? ` → ${erreurs.slice(0, 2).join(' | ')}` : ''));

      // 3. la page est dans la bonne langue et le déclare
      const suffixe = page === 'index.html' ? '/' : `/${page}`;
      const attenduCanonical = DOMAINE + (langue === 'fr' ? '' : '/en') + suffixe;
      const hreflangs = Object.fromEntries(etat.alternates);
      verifier(`${page} — langue et balises`,
        etat.lang === langue && etat.canonical === attenduCanonical
          && etat.alternates.length === 3
          && hreflangs.fr === DOMAINE + suffixe
          && hreflangs.en === `${DOMAINE}/en${suffixe}`
          && !!etat.titre && !!etat.description,
        `lang=${etat.lang} canonical=${etat.canonical}`);
    }

    // 4. le filtrage tient sans les JSON
    {
      const page = await navigateur.newPage();
      await page.goto(`${base}${prefixe}/projets.html`, { waitUntil: 'networkidle0' });
      const visibles = () => page.evaluate(() =>
        [...document.querySelectorAll('#projets .projet')].filter((c) => !c.hidden).length);
      const avant = await visibles();
      await page.click('#filtres-ouvrir');
      const valeur = await page.evaluate(() => {
        const b = document.querySelector('#filtres-panneau input[type=checkbox]');
        b.click();
        return b.value;
      });
      await new Promise((r) => setTimeout(r, 150));
      const pendant = await visibles();
      await page.click('#filtres-effacer');
      await new Promise((r) => setTimeout(r, 150));
      const apres = await visibles();
      verifier('projets.html — filtrage depuis les attributs du DOM',
        avant === 9 && pendant > 0 && pendant < 9 && apres === 9,
        `${avant} → ${pendant} (« ${valeur} ») → ${apres}`);
      await page.close();
    }

    // 5. sans JavaScript : ce pour quoi tout ceci existe
    {
      const { etat } = await mesurer(navigateur, `${base}${prefixe}/index.html`, { sansJs: true });
      const autreLangue = langue === 'fr' ? '/en/' : '/';
      verifier('index.html — lisible et navigable sans JavaScript',
        etat.parcours === 6 && etat.interets === 3 && etat.entete
          && etat.langues.includes(autreLangue),
        `parcours=${etat.parcours} intérêts=${etat.interets} témoin="${etat.temoin}" `
          + `langues=${JSON.stringify(etat.langues)}`);
    }
  }

  // 6. les fichiers que les moteurs vont chercher
  console.log('\nFichiers publiés');
  for (const fichier of ['robots.txt', 'sitemap.xml', 'index-en.html']) {
    const rep = await fetch(`${base}/${fichier}`);
    verifier(`${fichier} servi`, rep.ok, `HTTP ${rep.status}`);
  }
  const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  verifier('sitemap complet', urls.length === 8, `${urls.length} URLs (8 attendues)`);

  await navigateur.close();
  await fermer();

  console.log(echecs ? `\n${echecs} test(s) en échec.` : '\nTous les tests passent.');
  process.exit(echecs ? 1 : 0);
}

principal().catch((err) => {
  console.error('tests interrompus :', err);
  process.exit(1);
});
