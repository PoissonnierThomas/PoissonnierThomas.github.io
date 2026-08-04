import { monterLayout } from './layout.js';
import { rendre } from './render.js';
import { definirLangue, langueCourante } from './i18n.js';

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

function cablerTelephone() {
  const bouton = document.getElementById('tel');
  if (!bouton) return;

  bouton.addEventListener('click', () => {
    const brut = bouton.dataset.tel || '';
    bouton.textContent = brut.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
    bouton.dataset.revele = 'true';
    bouton.removeAttribute('data-i18n');
    bouton.disabled = true;
  });
}

function cablerLangues() {
  document.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => definirLangue(btn.dataset.lang));
  });
}

async function demarrer() {
  // L'ordre importe : i18n doit passer après l'injection et le rendu.
  await monterLayout(page);
  await rendre(page);
  await definirLangue(langueCourante());

  cablerLangues();
  cablerFiches();
  cablerTelephone();

  document.body.dataset.pret = 'true';
}

demarrer().catch((err) => {
  console.error('[portfolio] démarrage interrompu :', err);
  document.body.dataset.pret = 'erreur';
});
