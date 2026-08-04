/* Remplissage des gabarits : data-s -> textContent, data-s-i18n -> data-i18n,
   data-s-i18n-html -> data-i18n-html, data-s-attr="attr:champ" -> attribut. */

const $ = (sel, racine = document) => racine.querySelector(sel);

/* Même cache de promesses que js/i18n.js : sur competences.html, deux rendus
   concurrents réclament projets.json, et un seul fetch part. */
const enCache = new Map();

function donnees(nom) {
  if (enCache.has(nom)) return enCache.get(nom);

  const promesse = fetch(`data/${nom}.json`).then((reponse) => {
    if (!reponse.ok) throw new Error(`data/${nom}.json : ${reponse.status}`);
    return reponse.json();
  }).catch((err) => {
    enCache.delete(nom);
    throw err;
  });

  enCache.set(nom, promesse);
  return promesse;
}

function remplir(gabarit, valeurs) {
  const fragment = gabarit.content.cloneNode(true);

  fragment.querySelectorAll('[data-s]').forEach((el) => {
    const v = valeurs[el.dataset.s];
    if (v != null) el.textContent = v;
  });

  fragment.querySelectorAll('[data-s-i18n]').forEach((el) => {
    const v = valeurs[el.dataset.sI18n];
    if (v != null) el.dataset.i18n = v;
  });

  fragment.querySelectorAll('[data-s-i18n-html]').forEach((el) => {
    const v = valeurs[el.dataset.sI18nHtml];
    if (v != null) el.dataset.i18nHtml = v;
  });

  fragment.querySelectorAll('[data-s-attr]').forEach((el) => {
    el.dataset.sAttr.split(',').forEach((paire) => {
      const [attr, champ] = paire.split(':').map((s) => s.trim());
      const v = valeurs[champ];
      if (v != null) el.setAttribute(attr, v);
    });
  });

  return fragment;
}

function lienProjet(projet) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'lien-projet';
  b.dataset.fiche = idFicheDe(projet.id);
  b.dataset.i18n = projet.carte.titre;
  b.setAttribute('aria-haspopup', 'dialog');
  return b;
}

/* --- Parcours --- */
async function rendreParcours() {
  const cible = $('#parcours');
  const gabarit = $('#tpl-parcours');
  if (!cible || !gabarit) return;

  const etapes = await donnees('parcours');
  cible.append(...etapes.map((etape) => {
    const noeud = remplir(gabarit, etape);
    const li = noeud.querySelector('li');
    li.dataset.actuel = String(Boolean(etape.actuel));
    if (!etape.contexte) noeud.querySelector('.parcours-contexte')?.remove();
    return noeud;
  }));
}

/* --- Projets --- */

export const idFicheDe = (idProjet) => `fiche-${idProjet}`;

const aDuCodePublic = (projet) => projet.detail.liens.some((l) => l.externe);

async function rendreFiches(projets) {
  const fiches = $('#fiches');
  const tplFiche = $('#tpl-fiche');
  if (!fiches || !tplFiche) return;

  projets.forEach((projet) => {
    const fiche = remplir(tplFiche, {
      titre: projet.detail.titre,
      description: projet.detail.description,
    });
    fiche.querySelector('dialog').id = idFicheDe(projet.id);

    const desc = fiche.querySelector('.fiche-desc');
    if (projet.detail.html) {
      desc.dataset.i18nHtml = projet.detail.description;
      desc.removeAttribute('data-i18n');
    }

    const competences = fiche.querySelector('.fiche-competences');
    if (competences) {
      projet.tags.forEach((brut) => {
        const tag = document.createElement('span');
        tag.className = 'tag';
        if (typeof brut === 'string') tag.dataset.i18n = brut;
        else tag.textContent = brut.libelle;
        competences.append(tag);
      });
      if (!projet.tags.length) competences.remove();
    }

    const images = fiche.querySelector('.fiche-images');
    projet.detail.images.forEach((img) => {
      const el = document.createElement('img');
      el.src = img.src;
      el.alt = img.alt;
      el.loading = 'lazy';
      el.decoding = 'async';
      images.append(el);
    });

    const liens = fiche.querySelector('.fiche-liens');
    projet.detail.liens.forEach((lien) => {
      const a = document.createElement('a');
      a.className = 'btn';
      a.href = lien.href;
      if (lien.externe) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      } else {
        a.setAttribute('download', '');
      }
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'ico');
      svg.setAttribute('aria-hidden', 'true');
      const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', `assets/icons.svg#ico-${lien.externe ? 'external' : 'download'}`);
      svg.append(use);
      const libelle = document.createElement('span');
      if (lien.cle) libelle.dataset.i18n = lien.cle;
      else libelle.textContent = lien.libelle;
      a.append(svg, libelle);
      liens.append(a);
    });
    if (!projet.detail.liens.length) liens.remove();

    fiches.append(fiche);
  });
}

async function rendreProjets() {
  const projets = await donnees('projets');
  await rendreFiches(projets);

  const grille = $('#projets');
  const tplCarte = $('#tpl-projet');
  if (!grille || !tplCarte) return;

  const cartesParId = new Map();
  const appel = $('#projet-appel');

  projets.forEach((projet, i) => {
    const carte = remplir(tplCarte, {
      num: String(i + 1).padStart(2, '0'),
      annee: projet.annee,
      titre: projet.carte.titre,
      description: projet.carte.description,
      image: projet.carte.image,
      alt: projet.carte.alt,
    });

    const bouton = carte.querySelector('.projet');
    bouton.setAttribute('aria-haspopup', 'dialog');
    bouton.dataset.fiche = idFicheDe(projet.id);
    bouton.dataset.projet = projet.id;
    cartesParId.set(projet.id, bouton);

    carte.querySelector('.projet-icone use')
      ?.setAttribute('href', `assets/icons.svg#ico-${projet.icone}`);

    if (!projet.annee) carte.querySelector('.projet-annee')?.remove();

    if (!aDuCodePublic(projet)) carte.querySelector('.projet-code')?.remove();

    const tags = carte.querySelector('.tags');
    projet.technos.forEach((techno) => {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = techno;   // nom propre : non traduit
      tags.append(tag);
    });

    if (appel) grille.insertBefore(carte, appel);
    else grille.append(carte);
  });

  await rendreFiltres(projets, cartesParId, appel);
}

/* --- Filtres --- */

const SOURCES = {
  techno: {
    // le Set fusionne les technos qu'un alias ramène à une même entrée
    valeurs: (projet, facette, config) => [...new Set(
      projet.technos
        .filter((t) => config.technos[t] === facette.categorie)
        .map((t) => config.alias?.[t] ?? t),
    )],
    cle: null,
  },
  annee: {
    valeurs: (projet) => (projet.annee ? [projet.annee] : []),
    cle: (valeur) => valeur,
  },
  code: {
    valeurs: (projet) => (aDuCodePublic(projet) ? ['public'] : []),
    cle: () => 'filtre.code.public',
  },
};

async function rendreFiltres(projets, cartesParId, appel) {
  const panneau = $('#filtres-panneau');
  const declencheur = $('#filtres-ouvrir');
  if (!panneau || !declencheur) return;

  const config = await donnees('facettes');
  const facettes = config.facettes.filter((f) => SOURCES[f.source]);
  const valeursDe = (projet, facette) =>
    SOURCES[facette.source].valeurs(projet, facette, config);

  const selection = new Map();

  facettes.forEach((facette) => {
    const compte = new Map();
    projets.forEach((p) => valeursDe(p, facette)
      .forEach((v) => compte.set(v, (compte.get(v) || 0) + 1)));
    if (!compte.size) return;   // aucune valeur : la facette ne s'affiche pas

    selection.set(facette.id, new Set());

    const ordre = [...compte.entries()].sort(
      facette.source === 'techno'
        ? (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr')
        : (a, b) => a[0].localeCompare(b[0], 'fr'),
    );

    const bloc = document.createElement('fieldset');
    bloc.className = 'facette';

    const titre = document.createElement('legend');
    titre.className = 'facette-titre label';
    titre.dataset.i18n = facette.cle;
    bloc.append(titre);

    const options = document.createElement('div');
    options.className = 'facette-options';

    ordre.forEach(([valeur, n]) => {
      const etiquette = document.createElement('label');
      etiquette.className = 'option';

      const boite = document.createElement('input');
      boite.type = 'checkbox';
      boite.value = valeur;
      boite.dataset.facette = facette.id;

      const nom = document.createElement('span');
      nom.className = 'option-nom';
      const cle = SOURCES[facette.source].cle;
      if (cle) nom.dataset.i18n = cle(valeur);
      else nom.textContent = valeur;

      const badge = document.createElement('span');
      badge.className = 'option-compte';
      badge.textContent = String(n);

      etiquette.append(boite, nom, badge);
      options.append(etiquette);
    });

    bloc.append(options);
    panneau.append(bloc);
  });

  const badgeActifs = $('#filtres-actifs');
  const boutonEffacer = $('#filtres-effacer');
  const resultat = $('#filtres-resultat');
  const vide = $('#filtre-vide');

  let dernierCompte = projets.length;

  function ajusterAppel(visibles) {
    if (!appel) return;
    dernierCompte = visibles;
    const colonnes = getComputedStyle(appel.parentElement)
      .gridTemplateColumns.split(' ').length;
    appel.classList.toggle('projet-appel--large', visibles % colonnes === 0);
  }

  // ajusterAppel lit gridTemplateColumns, ce qui force un calcul de style ;
  // sur un redimensionnement continu l'événement part des dizaines de fois par
  // seconde. On n'en garde qu'un par trame, la cadence à laquelle l'écran
  // pourrait de toute façon afficher le résultat.
  let ajustementPrevu = false;
  window.addEventListener('resize', () => {
    if (ajustementPrevu) return;
    ajustementPrevu = true;
    requestAnimationFrame(() => {
      ajustementPrevu = false;
      ajusterAppel(dernierCompte);
    });
  });

  function appliquerFiltres() {
    let visibles = 0;
    projets.forEach((projet) => {
      const carte = cartesParId.get(projet.id);
      if (!carte) return;
      const garde = facettes.every((facette) => {
        const choisies = selection.get(facette.id);
        if (!choisies || !choisies.size) return true;   // facette au repos
        return valeursDe(projet, facette).some((v) => choisies.has(v));
      });
      carte.hidden = !garde;
      visibles += garde ? 1 : 0;
    });

    const actifs = [...selection.values()].reduce((n, s) => n + s.size, 0);
    if (badgeActifs) {
      badgeActifs.textContent = String(actifs);
      badgeActifs.hidden = actifs === 0;
    }
    if (boutonEffacer) boutonEffacer.hidden = actifs === 0;
    if (resultat) resultat.textContent = actifs ? `${visibles} / ${projets.length}` : '';
    if (vide) vide.hidden = visibles > 0;
    ajusterAppel(visibles);
  }

  panneau.addEventListener('change', (e) => {
    const boite = e.target;
    if (!(boite instanceof HTMLInputElement)) return;
    const choisies = selection.get(boite.dataset.facette);
    if (!choisies) return;
    if (boite.checked) choisies.add(boite.value);
    else choisies.delete(boite.value);
    appliquerFiltres();
  });

  const ouvrir = (etat) => {
    declencheur.setAttribute('aria-expanded', String(etat));
    panneau.hidden = !etat;
  };

  declencheur.addEventListener('click', () => {
    ouvrir(declencheur.getAttribute('aria-expanded') !== 'true');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || panneau.hidden) return;
    // une fiche ouverte capte Échap pour elle-même
    if (document.querySelector('dialog[open]')) return;
    ouvrir(false);
    declencheur.focus();
  });

  boutonEffacer?.addEventListener('click', () => {
    selection.forEach((s) => s.clear());
    panneau.querySelectorAll('input[type="checkbox"]').forEach((b) => { b.checked = false; });
    appliquerFiltres();
  });

  appliquerFiltres();
}

function remplirApplique(cible, applique, parId) {
  if (!cible || !applique) return;

  if (applique.texte) {                 // phrase entière, sans projet cité
    cible.dataset.i18n = applique.texte;
    return;
  }

  const prefixe = document.createElement('span');
  prefixe.dataset.i18n = applique.prefixe;
  cible.append(prefixe, document.createTextNode(' '));

  const morceaux = [];

  (applique.projets || []).forEach((id) => {
    const projet = parId.get(id);
    if (!projet) return;               // identifiant inconnu : on n'invente pas
    morceaux.push(lienProjet(projet));
  });

  (applique.extras || []).forEach((cleTexte) => {
    const s = document.createElement('span');
    s.dataset.i18n = cleTexte;
    morceaux.push(s);
  });

  morceaux.forEach((el, i) => {
    if (i) cible.append(document.createTextNode(', '));
    cible.append(el);
  });
}

/* --- Compétences --- */
async function rendreCompetences() {
  const c = await donnees('competences');
  const projets = await donnees('projets');
  const parId = new Map(projets.map((p) => [p.id, p]));

  // les contextes ne sont plus affichés par ligne, mais servent encore au tri
  const contexteRang = Object.fromEntries(c.contextes.map((x, i) => [x.id, i]));

  // une compétence se relie à ses projets par ses technos, ou par des id
  // explicites — même mécanisme que `applique.projets` des expertises. Utile
  // pour une compétence transversale qu'aucune techno de projet ne porte.
  const projetsDe = (item) =>
    projets.filter((p) => p.technos.some((t) => item.technos.includes(t))
      || (item.projets || []).includes(p.id));

  // --- groupes (langages, outils)
  const zoneGroupes = $('#comp-groupes');
  const tplGroupe = $('#tpl-comp-groupe');
  const tplLigne = $('#tpl-comp-ligne');
  if (zoneGroupes && tplGroupe && tplLigne) {
    c.groupes.forEach((groupe) => {
      const noeud = remplir(tplGroupe, { titre: groupe.titre });
      noeud.querySelector('.comp-groupe-tete .ico use')
        ?.setAttribute('href', `assets/icons.svg#ico-${groupe.icone}`);
      const liste = noeud.querySelector('.comp-lignes');

      const poids = (item) => Math.min(...item.contextes.map((x) => contexteRang[x]));
      const items = [...groupe.items].sort((a, b) =>
        poids(a) - poids(b)
        || projetsDe(b).length - projetsDe(a).length
        || a.nom.localeCompare(b.nom, 'fr'));

      items.forEach((item) => {
        const ligne = remplir(tplLigne, {
          nom: item.nom,
          description: item.description,
        });

        const cible = ligne.querySelector('.comp-projets');
        const lies = projetsDe(item);
        lies.forEach((p) => cible.append(lienProjet(p)));
        if (!lies.length) cible.remove();

        liste.append(ligne);
      });
      zoneGroupes.append(noeud);
    });
  }

  // --- expertises
  const zoneExpertises = $('#expertises');
  const tplExpertise = $('#tpl-expertise');
  if (zoneExpertises && tplExpertise) {
    c.expertises.forEach((exp) => {
      const noeud = remplir(tplExpertise, {
        titre: exp.titre,
        description: exp.description,
      });
      noeud.querySelector('.ico use')
        ?.setAttribute('href', `assets/icons.svg#ico-${exp.icone}`);
      remplirApplique(noeud.querySelector('.expertise-applique'), exp.applique, parId);
      zoneExpertises.append(noeud);
    });
  }

  // --- savoir-être
  const zoneSavoirs = $('#savoir-etre');
  const tplSavoir = $('#tpl-savoir');
  if (zoneSavoirs && tplSavoir) {
    c.savoirEtre.forEach((s) => {
      const noeud = remplir(tplSavoir, { titre: s.titre, description: s.description });
      noeud.querySelector('.ico use')
        ?.setAttribute('href', `assets/icons.svg#ico-${s.icone}`);
      zoneSavoirs.append(noeud);
    });
  }

  const zoneContextes = $('#contextes');
  const tplContexte = $('#tpl-contexte');
  if (zoneContextes && tplContexte) {
    const employes = new Set(c.groupes.flatMap((g) => g.items.flatMap((i) => i.contextes)));
    c.contextes.filter((x) => employes.has(x.id)).forEach((x) => {
      const noeud = remplir(tplContexte, { titre: x.cle, description: x.description });
      noeud.querySelector('.contexte-fiche').dataset.contexte = x.id;
      zoneContextes.append(noeud);
    });
  }
}

/* --- Intérêts --- */
async function rendreInterets() {
  const cible = $('#interets');
  const gabarit = $('#tpl-interet');
  if (!cible || !gabarit) return;

  const interets = await donnees('interets');
  interets.forEach((interet) => {
    const noeud = remplir(gabarit, {
      titre: interet.titre,
      description: interet.description,
      image: interet.image,
      alt: interet.alt,
      legende: interet.legende,
      role: interet.role,
    });
    noeud.querySelector('.ico use')
      ?.setAttribute('href', `assets/icons.svg#ico-${interet.icone}`);
    if (interet.image) noeud.querySelector('.interet')?.classList.add('interet--large');
    else noeud.querySelector('.interet-club')?.remove();
    cible.append(noeud);
  });
}

export async function rendre(page) {
  const taches = {
    index: [rendreParcours, rendreInterets],
    projets: [rendreProjets],
    competences: [rendreCompetences, async () => rendreFiches(await donnees('projets'))],
    contact: [],
  }[page] || [];

  await Promise.all(taches.map((f) => f()));
}
