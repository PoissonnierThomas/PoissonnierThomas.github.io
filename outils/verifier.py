#!/usr/bin/env python3
"""Contrôles de cohérence du portfolio.

Le site n'a ni build ni test unitaire : les fichiers de données se citent
mutuellement par chaîne de caractères, et rien ne le vérifie à l'exécution.
Une techno non classée disparaît silencieusement du panneau de filtres, une
clé absente de en.json laisse du français dans la version anglaise. Ce script
rend ces pannes visibles.

    python3 outils/verifier.py

Sortie 0 si tout est cohérent, 1 sinon — c'est ce que lit la CI.
"""

import json
import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
anomalies = []


def lire_json(chemin):
    return json.loads((RACINE / chemin).read_text(encoding='utf-8'))


def signaler(titre, valeurs):
    """Affiche le résultat d'un contrôle et retient les échecs."""
    valeurs = sorted(valeurs)
    if valeurs:
        anomalies.append(titre)
        print(f"  ✗ {titre} : {', '.join(map(str, valeurs))}")
    else:
        print(f"  ✓ {titre}")


def pages_html():
    """Les pages réellement servies : le stub anglais et les maquettes sortent."""
    fichiers = list(RACINE.glob('*.html')) + list(RACINE.glob('partials/*.html'))
    return [p for p in fichiers
            if p.name != 'index-en.html' and not p.name.startswith('mockup')]


# --- 1. Clés de traduction -------------------------------------------------

def verifier_i18n():
    print('\nTraductions')
    utilisees = set()
    for page in pages_html():
        html = page.read_text(encoding='utf-8')
        utilisees |= set(re.findall(r'data-i18n(?:-html|-href)?="([^"]+)"', html))
        utilisees |= {paire.split(':', 1)[1].strip()
                      for attr in re.findall(r'data-i18n-attr="([^"]+)"', html)
                      for paire in attr.split(',')}

    # Les données citent des clés en valeur (carte.titre, tags, années…).
    # Le tiret compte : les clés de projet portent l'identifiant, qui en
    # contient (projet.stage-cba.carte.titre). Avec \w seul, ce contrôle ne
    # verrait plus aucune clé de projet et validerait n'importe quoi.
    for fichier in sorted(RACINE.glob('data/*.json')):
        brut = json.dumps(json.loads(fichier.read_text(encoding='utf-8')),
                          ensure_ascii=False)
        utilisees |= set(re.findall(r'"([a-z][\w.-]*\.[\w.-]+)"', brut))

    fr, en = lire_json('i18n/fr.json'), lire_json('i18n/en.json')
    signaler('clés présentes en fr seulement', set(fr) - set(en))
    signaler('clés présentes en en seulement', set(en) - set(fr))
    signaler('clés référencées mais absentes', {c for c in utilisees if c not in fr})


# --- 2. Cohérence des données ----------------------------------------------

def verifier_donnees():
    print('\nDonnées')
    projets = lire_json('data/projets.json')
    facettes = lire_json('data/facettes.json')
    comp = lire_json('data/competences.json')

    technos = {t for p in projets for t in p['technos']}
    ids = {p['id'] for p in projets}
    alias = facettes.get('alias', {})

    signaler('technos non classées', technos - set(facettes['technos']))
    signaler('classements orphelins', set(facettes['technos']) - technos)
    signaler('alias sur techno inconnue', set(alias) - set(facettes['technos']))

    # un alias qui enjambe deux catégories apparaît une fois par facette
    a_cheval = {cible for cible in set(alias.values())
                if len({facettes['technos'][cle]
                        for cle in alias if alias[cle] == cible}) > 1}
    signaler('alias à cheval sur deux catégories', a_cheval)

    signaler('contextes inconnus',
             {c for g in comp['groupes'] for i in g['items'] for c in i['contextes']}
             - {c['id'] for c in comp['contextes']})
    signaler('technos de compétence inconnues',
             {t for g in comp['groupes'] for i in g['items'] for t in i['technos']}
             - technos)

    # NB : les parenthèses comptent, « - » lie plus fort que « | » en Python
    references = ({r for e in comp['expertises']
                   for r in (e.get('applique') or {}).get('projets', [])}
                  | {r for g in comp['groupes'] for i in g['items']
                     for r in i.get('projets', [])})
    signaler('projets cités mais inexistants', references - ids)


# --- 3. Icônes et fichiers référencés --------------------------------------

def verifier_assets():
    print('\nFichiers')
    sprite = {bloc.split('"')[0] for bloc in
              (RACINE / 'assets/icons.svg').read_text(encoding='utf-8').split('id="ico-')[1:]}

    icones = set()
    for fichier in sorted(RACINE.glob('data/*.json')):
        icones |= set(re.findall(r'"icone":\s*"([^"]+)"',
                                 fichier.read_text(encoding='utf-8')))
    for page in pages_html():
        icones |= set(re.findall(r'#ico-([a-z-]+)', page.read_text(encoding='utf-8')))
    signaler('icônes absentes du sprite', icones - sprite)

    # Un chemin d'asset est toujours une chaîne entre guillemets. Plusieurs
    # contiennent des espaces et des accents : on borne au guillemet, jamais
    # à l'espace, sous peine de tronquer le chemin.
    sources = (pages_html() + sorted(RACINE.glob('data/*.json'))
               + sorted(RACINE.glob('i18n/*.json')) + sorted(RACINE.glob('css/*.css')))
    manquants = set()
    for fichier in sources:
        texte = fichier.read_text(encoding='utf-8')
        for guillemet in ('"', "'"):
            for trouve in re.findall(rf'{guillemet}([^{guillemet}]*){guillemet}', texte):
                chemin = trouve.split('#')[0]
                if not chemin.startswith(('assets/', '../assets/')):
                    continue
                if not (RACINE / chemin.removeprefix('../')).exists():
                    manquants.add(chemin)
    signaler('fichiers référencés mais absents', manquants)


# --- 4. Compteurs écrits en toutes lettres -------------------------------

def verifier_compteurs():
    """Deux endroits annoncent le nombre de projets en dur, loin des données.

    Ils ont été oubliés lors de l'ajout de FoxCorrector : la grille affichait
    « 9 réalisations » sous dix cartes. Rien ne peut le rattraper à l'exécution,
    d'où ce contrôle.
    """
    print('\nCompteurs')
    total = len(lire_json('data/projets.json'))

    faux = set()
    for langue in ('fr', 'en'):
        annonce = lire_json(f'i18n/{langue}.json').get('projets.compte', '')
        nombre = re.match(r'\s*(\d+)', annonce)
        if not nombre or int(nombre.group(1)) != total:
            faux.add(f'i18n/{langue}.json projets.compte = "{annonce}" au lieu de {total}')
    signaler(f'annonce du nombre de projets ({total})', faux)

    accueil = (RACINE / 'index.html').read_text(encoding='utf-8')
    stat = re.search(r'<div class="stat-nombre">(\d+)</div>\s*'
                     r'<div class="stat-label" data-i18n="stats\.projets\.label"', accueil)
    ecart = set()
    if not stat:
        ecart.add('bloc introuvable dans index.html — le contrôle ne vaut plus rien')
    elif int(stat.group(1)) != total:
        ecart.add(f'index.html annonce {stat.group(1)} au lieu de {total}')
    signaler('statistique « projets et expériences »', ecart)


if __name__ == '__main__':
    verifier_i18n()
    verifier_donnees()
    verifier_assets()
    verifier_compteurs()

    if anomalies:
        print(f"\n{len(anomalies)} contrôle(s) en échec.")
        sys.exit(1)
    print('\nTous les contrôles passent.')
