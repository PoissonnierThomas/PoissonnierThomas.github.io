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

  // même chose, mais la valeur est une clé : c'est i18n qui posera l'attribut.
  // Sert aux alt, qui doivent suivre la langue comme le reste du texte.
  fragment.querySelectorAll('[data-s-i18n-attr]').forEach((el) => {
    const paires = [];
    el.dataset.sI18nAttr.split(',').forEach((paire) => {
      const [attr, champ] = paire.split(':').map((s) => s.trim());
      const v = valeurs[champ];
      if (v != null) paires.push(`${attr}:${v}`);
    });
    if (paires.length) el.dataset.i18nAttr = paires.join(',');
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
    const fiche = remplir(tplFiche, { titre: projet.detail.titre });
    fiche.querySelector('dialog').id = idFicheDe(projet.id);

    // Le contenu est une suite ordonnée de blocs : chaque illustration se place
    // à l'endroit du propos qu'elle sert, plutôt qu'en bloc après le texte.
    const contenu = fiche.querySelector('.fiche-contenu');
    projet.detail.blocs.forEach((bloc) => {
      if (bloc.texte) {
        const p = document.createElement('p');
        p.className = 'fiche-desc';
        p.dataset[projet.detail.html ? 'i18nHtml' : 'i18n'] = bloc.texte;
        contenu.append(p);
        return;
      }

      const el = document.createElement('img');
      el.src = bloc.image;
      el.dataset.i18nAttr = `alt:${bloc.alt}`;   // alt traduit comme le reste
      el.loading = 'lazy';
      el.decoding = 'async';

      // `titre` est optionnel : une capture d'écran gagne à être située,
      // un graphique porte déjà son titre à l'intérieur de l'image
      if (!bloc.titre) {
        contenu.append(el);
        return;
      }
      const figure = document.createElement('figure');
      const legende = document.createElement('figcaption');
      legende.dataset.i18n = bloc.titre;
      figure.append(el, legende);
      contenu.append(figure);
    });

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

  await construireFiltres(projets, cartesParId);
}

/* --- Filtres ---
   Deux temps volontairement séparés. construireFiltres() bâtit le panneau et
   inscrit sur chaque carte les valeurs qui la caractérisent ; cablerFiltres()
   ne lit plus que le DOM. Après pré-rendu la construction a déjà eu lieu et
   n'est pas rejouée, si bien que le filtrage fonctionne sans retélécharger
   projets.json ni facettes.json — d'où le passage par des attributs. */

const attrFacette = (id) => `data-f-${id}`;

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

async function construireFiltres(projets, cartesParId) {
  const panneau = $('#filtres-panneau');
  if (!panneau) return;

  const config = await donnees('facettes');
  const facettes = config.facettes.filter((f) => SOURCES[f.source]);
  const valeursDe = (projet, facette) =>
    SOURCES[facette.source].valeurs(projet, facette, config);

  // ce que chaque carte porte décide de son sort au filtrage
  projets.forEach((projet) => {
    const carte = cartesParId.get(projet.id);
    if (!carte) return;
    facettes.forEach((facette) => {
      const valeurs = valeursDe(projet, facette);
      if (valeurs.length) carte.setAttribute(attrFacette(facette.id), valeurs.join('|'));
    });
  });

  facettes.forEach((facette) => {
    const compte = new Map();
    projets.forEach((p) => valeursDe(p, facette)
      .forEach((v) => compte.set(v, (compte.get(v) || 0) + 1)));
    if (!compte.size) return;   // aucune valeur : la facette ne s'affiche pas

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
}

export function cablerFiltres() {
  const panneau = $('#filtres-panneau');
  const declencheur = $('#filtres-ouvrir');
  if (!panneau || !declencheur) return;

  const cartes = [...document.querySelectorAll('#projets .projet')];
  const appel = $('#projet-appel');

  // les facettes en jeu sont celles que le panneau expose, pas celles des JSON
  const selection = new Map();
  panneau.querySelectorAll('input[type="checkbox"][data-facette]').forEach((boite) => {
    if (!selection.has(boite.dataset.facette)) selection.set(boite.dataset.facette, new Set());
  });

  const valeursDe = (carte, idFacette) => {
    const brut = carte.getAttribute(attrFacette(idFacette));
    return brut ? brut.split('|') : [];
  };

  const badgeActifs = $('#filtres-actifs');
  const boutonEffacer = $('#filtres-effacer');
  const resultat = $('#filtres-resultat');
  const vide = $('#filtre-vide');

  let dernierCompte = cartes.length;

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
    cartes.forEach((carte) => {
      const garde = [...selection.entries()].every(([idFacette, choisies]) => {
        if (!choisies.size) return true;   // facette au repos
        return valeursDe(carte, idFacette).some((v) => choisies.has(v));
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
    if (resultat) resultat.textContent = actifs ? `${visibles} / ${cartes.length}` : '';
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
        if (item.texte) {
          // une compétence transversale ne gagne rien à lister dix liens :
          // une phrase dit la même chose sans noyer la ligne
          cible.dataset.i18n = item.texte;
        } else {
          const lies = projetsDe(item);
          lies.forEach((p) => cible.append(lienProjet(p)));
          if (!lies.length) cible.remove();
        }

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

/* Câblage des interactions, sur un DOM déjà construit — que celui-ci vienne du
   rendu client ou du pré-rendu. Contrairement à rendre(), ne touche à aucune
   donnée : tout ce dont il a besoin est dans la page. */
export function cabler(page) {
  if (page === 'projets') cablerFiltres();
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
