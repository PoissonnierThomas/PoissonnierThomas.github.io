import { monterLayout, cablerLayout } from './layout.js';
import { rendre, cabler } from './render.js';
import { charger, definirLangue, langueCourante } from './i18n.js';

const page = document.body.dataset.page || 'index';

/* Posé par outils/construire.js : en-tête, contenu et traductions sont déjà
   dans le HTML livré. Reconstruire par-dessus dupliquerait tout ; il ne reste
   qu'à câbler les interactions. */
const prerendu = document.body.dataset.prerendu === 'true';

function cablerFiches() {
  document.querySelectorAll('[data-fiche]').forEach((declencheur) => {
    declencheur.addEventListener('click', () => {
      const fiche = document.getElementById(declencheur.dataset.fiche);
      if (!fiche) return;

      fiche.showModal();
      // fige le fond : un <dialog> modal bloque les clics derrière lui, jamais
      // la molette. Connu et non résolu : showModal() déplace au passage la
      // position de défilement du fond, qu'on retrouve donc ailleurs en
      // fermant — ni requestAnimationFrame ni la neutralisation de
      // `scroll-behavior` n'ont suffi à la rétablir.
      document.body.classList.add('fiche-ouverte');
    });
  });

  document.querySelectorAll('dialog.fiche').forEach((fiche) => {
    fiche.querySelector('.fiche-fermer')
      ?.addEventListener('click', () => fiche.close());

    fiche.addEventListener('click', (e) => {
      if (e.target === fiche) fiche.close();
    });

    // `close` couvre les trois sorties : bouton, clic sur le fond, touche Échap
    fiche.addEventListener('close', () => {
      document.body.classList.remove('fiche-ouverte');
    });
  });
}

function cablerLangues() {
  document.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => definirLangue(btn.dataset.lang));
  });
}

async function demarrer() {
  if (prerendu) {
    // rien à charger : le sélecteur de langue est devenu un jeu de liens, et
    // la locale est portée par l'URL et non plus par localStorage
    cablerLayout();
  } else {
    // Les trois chargements sont indépendants : le layout vise #zone-entete et
    // #zone-pied, le rendu vise des conteneurs déjà présents dans la page, et
    // les traductions ne visent rien tant qu'on ne les applique pas. On les
    // lance donc ensemble, en une vague au lieu de trois.
    // Seule l'APPLICATION des traductions doit suivre le rendu, faute de quoi
    // tout bloc construit à partir des données resterait en français.
    await Promise.all([
      monterLayout(page),
      rendre(page),
      charger(langueCourante()),   // remplit le cache ; definirLangue le relira
    ]);

    await definirLangue(langueCourante());
    cablerLangues();
  }

  cabler(page);
  cablerFiches();

  devoiler('true');
}

/* Le contenu est masqué par le script de <head> tant que la page n'est pas
   prête ; c'est ici qu'on lève le voile, succès ou échec. */
function devoiler(etat) {
  document.body.dataset.pret = etat;
  delete document.documentElement.dataset.chargement;
}

demarrer().catch((err) => {
  console.error('[portfolio] démarrage interrompu :', err);
  devoiler('erreur');
});
