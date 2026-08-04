/* data-i18n -> textContent, data-i18n-html -> innerHTML,
   data-i18n-attr="attr:clé" -> attribut, data-i18n-href -> href */

const CLE_STOCKAGE = 'portfolio-lang';
const DEFAUT = 'fr';
const cache = new Map();

export function langueCourante() {
  return localStorage.getItem(CLE_STOCKAGE) || DEFAUT;
}

/* Le cache retient la *promesse*, pas le résultat : deux appels concurrents
   partagent alors un seul fetch. Un échec est retiré du cache pour qu'un appel
   ultérieur puisse retenter. */
export function charger(lang) {
  if (cache.has(lang)) return cache.get(lang);

  const promesse = fetch(`i18n/${lang}.json`).then((reponse) => {
    if (!reponse.ok) throw new Error(`i18n/${lang}.json : ${reponse.status}`);
    return reponse.json();
  }).catch((err) => {
    cache.delete(lang);
    throw err;
  });

  cache.set(lang, promesse);
  return promesse;
}

export function appliquer(t, racine = document) {
  racine.querySelectorAll('[data-i18n]').forEach((el) => {
    const v = t[el.dataset.i18n];
    if (v !== undefined) el.textContent = v;
  });

  racine.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const v = t[el.dataset.i18nHtml];
    if (v !== undefined) el.innerHTML = v;
  });

  racine.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.dataset.i18nAttr.split(',').forEach((paire) => {
      const [attr, cle] = paire.split(':').map((s) => s.trim());
      const v = t[cle];
      if (v !== undefined) el.setAttribute(attr, v);
    });
  });

  racine.querySelectorAll('[data-i18n-href]').forEach((el) => {
    const v = t[el.dataset.i18nHref];
    if (v !== undefined) el.setAttribute('href', v);
  });

  if (racine === document) appliquerMeta(t);
}

function appliquerMeta(t) {
  const poser = (selecteur, valeur) => {
    if (valeur === undefined) return;
    document.querySelector(selecteur)?.setAttribute('content', valeur);
  };
  poser('meta[name="description"]', t['meta.description']);
  poser('meta[property="og:description"]', t['og.description']);
  poser('meta[property="og:url"]', t['og.url']);
  poser('meta[name="twitter:description"]', t['twitter.description']);
}

export async function definirLangue(lang) {
  const t = await charger(lang);
  document.documentElement.lang = lang;
  localStorage.setItem(CLE_STOCKAGE, lang);
  appliquer(t);
  document.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.lang === lang));
  });
  return t;
}
