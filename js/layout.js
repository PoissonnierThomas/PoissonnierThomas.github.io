async function injecter(url, cible) {
  const reponse = await fetch(url);
  if (!reponse.ok) throw new Error(`${url} : ${reponse.status}`);
  cible.innerHTML = await reponse.text();
}

function marquerPageActive(page) {
  document.querySelectorAll('.nav a[data-page]').forEach((a) => {
    if (a.dataset.page === page) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

function cablerMenu() {
  const burger = document.getElementById('burger');
  const nav = document.getElementById('nav');
  if (!burger || !nav) return;

  const basculer = (ouvert) => {
    nav.dataset.ouvert = String(ouvert);
    burger.setAttribute('aria-expanded', String(ouvert));
  };

  burger.addEventListener('click', () => {
    basculer(nav.dataset.ouvert !== 'true');
  });

  nav.addEventListener('click', (e) => {
    if (e.target.closest('a')) basculer(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.dataset.ouvert === 'true') basculer(false);
  });
}

function cablerDefilement() {
  const entete = document.getElementById('entete');
  if (!entete) return;
  const majEtat = () => {
    entete.dataset.defile = String(window.scrollY > 8);
  };
  majEtat();
  window.addEventListener('scroll', majEtat, { passive: true });
}

/* Les seules interactions de l'en-tête. Séparé de monterLayout() parce qu'après
   pré-rendu le balisage est déjà là et qu'il n'y a plus rien à injecter. */
export function cablerLayout() {
  cablerMenu();
  cablerDefilement();
}

export async function monterLayout(page) {
  const haut = document.getElementById('zone-entete');
  const bas = document.getElementById('zone-pied');

  await Promise.all([
    haut ? injecter('partials/header.html', haut) : null,
    bas ? injecter('partials/footer.html', bas) : null,
  ]);

  marquerPageActive(page);
  cablerLayout();
}
