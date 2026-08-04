import { monterLayout } from './layout.js';
import { rendre } from './render.js';
import { charger, definirLangue, langueCourante } from './i18n.js';

const page = document.body.dataset.page || 'index';

function cablerFiches() {
  document.querySelectorAll('[data-fiche]').forEach((declencheur) => {
    declencheur.addEventListener('click', () => {
      document.getElementById(declencheur.dataset.fiche)?.showModal();
    });
  });

  document.querySelectorAll('dialog.fiche').forEach((fiche) => {
    fiche.querySelector('.fiche-fermer')
      ?.addEventListener('click', () => fiche.close());

    fiche.addEventListener('click', (e) => {
      if (e.target === fiche) fiche.close();
    });
  });
}

function cablerLangues() {
  document.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => definirLangue(btn.dataset.lang));
  });
}

async function demarrer() {
  // Les trois chargements sont indépendants : le layout vise #zone-entete et
  // #zone-pied, le rendu vise des conteneurs déjà présents dans la page, et les
  // traductions ne visent rien tant qu'on ne les applique pas. On les lance
  // donc ensemble, en une vague au lieu de trois.
  // Seule l'APPLICATION des traductions doit suivre le rendu, faute de quoi
  // tout bloc construit à partir des données resterait en français.
  await Promise.all([
    monterLayout(page),
    rendre(page),
    charger(langueCourante()),   // rempli le cache ; definirLangue le relira
  ]);

  await definirLangue(langueCourante());

  cablerLangues();
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
