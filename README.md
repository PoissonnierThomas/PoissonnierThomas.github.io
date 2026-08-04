# Portfolio — Thomas Poissonnier

Portfolio personnel hébergé sur GitHub Pages.

**Lien :** [poissonnierthomas.github.io](https://poissonnierthomas.github.io/)

## Stack

Site statique, sans framework, sans étape de build ni gestionnaire de paquets :
HTML, CSS et modules JavaScript servis tels quels.

- **Données** — fichiers JSON plats dans `data/`
- **Balisage** — éléments `<template>` en bas de chaque page
- **Rendu** — `js/render.js`, la seule couche à remplacer pour changer de technologie
- **Bilingue** — français et anglais depuis `i18n/`, le contenu étant traduit après
  chargement plutôt que dupliqué page par page

## Développement

Servir le dossier en HTTP :

```bash
python3 -m http.server 8000
```

Le protocole HTTP est indispensable : les partiels, les données et les
traductions sont chargés par `fetch`, ce qu'une ouverture directe du fichier
interdit.

## Déploiement

Pousser sur `main` publie le site : le dépôt distant **est** celui de GitHub
Pages, il n'y a pas d'étape de construction séparée.
