/* Petit serveur de fichiers, partagé par le pré-rendu et les tests.
 *
 * Les deux ont besoin de servir un répertoire sur un port libre : le build
 * sert les sources qu'il va parcourir, les tests servent dist/. En avoir deux
 * copies, c'est se garantir qu'un jour l'une gérera les accents et pas l'autre.
 */

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

/* Renvoie { serveur, port, base, fermer }. Le port 0 laisse le système en
   choisir un libre : deux exécutions simultanées ne se marchent pas dessus. */
export function servir(racine) {
  const serveur = http.createServer(async (req, rep) => {
    // plusieurs dossiers d'images contiennent espaces et accents
    let rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    let cible = path.join(racine, rel || 'index.html');
    if (!cible.startsWith(racine)) { rep.writeHead(403).end(); return; }

    try {
      // /en/ doit servir /en/index.html, comme le ferait Pages
      if ((await fs.stat(cible)).isDirectory()) cible = path.join(cible, 'index.html');
    } catch { /* le readFile ci-dessous répondra 404 */ }

    try {
      const corps = await fs.readFile(cible);
      rep.writeHead(200, {
        'Content-Type': TYPES[path.extname(cible)] || 'application/octet-stream',
      });
      rep.end(corps);
    } catch {
      rep.writeHead(404).end('introuvable');
    }
  });

  return new Promise((resoudre) => {
    serveur.listen(0, '127.0.0.1', () => {
      const { port } = serveur.address();
      resoudre({
        serveur,
        port,
        base: `http://127.0.0.1:${port}`,
        fermer: () => new Promise((fini) => serveur.close(fini)),
      });
    });
  });
}
