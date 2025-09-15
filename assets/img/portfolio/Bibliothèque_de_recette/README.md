# S2.01 - Gestionnaire de Recettes - Groupe 19

## Liste des membres

- **BEKKARI Chadi**
- **POISSONNIER Thomas**

## Description du projet

Application Qt de gestion de recettes de cuisine permettant l'affichage, l'édition et la gestion de recettes culinaires. L'application supporte les formats de fichiers XML et JSON pour l'import/export des données.

## Objectifs

- Créer une interface graphique intuitive pour la gestion de recettes
- Implémenter le modèle **Master/Detail** pour la navigation
- Supporter plusieurs formats de données (XML, JSON)
- Assurer la persistance des données
- Interface responsive et moderne

### Format des données

#### Structure XML

```xml
<recette>
    <nom>Nom de la recette</nom>
    <photo>chemin/image.jpg</photo>
    <catégorie>Plat</catégorie>
    <description>Description de la recette</description>
    <nombre_personnes>4</nombre_personnes>
    <prix>12.50</prix>
    <createur>Chef</createur>
    <date>15/03/2024</date>
    <ingredient>
        <nom>Ingrédient</nom>
        <quantite>250</quantite>
        <unite>g</unite>
    </ingredient>
</recette>
```

#### Structure JSON

```json
{
    "nom": "Nom de la recette",
    "photo": "chemin/image.jpg",
    "categorie": "Plat",
    "description": "Description de la recette",
    "nombre_personnes": 4,
    "prix": 12.50,
    "createur": "Chef",
    "date": "15/03/2024",
    "ingredients": [
        {
            "nom": "Ingrédient",
            "quantite": 250,
            "unite": "g"
        }
    ]
}
```

## Fonctionnalités

### Gestion des données

- [x] **Parsing XML** - Lecture des recettes depuis fichiers XML
- [x] **Parsing JSON** - Lecture des recettes depuis fichiers JSON
- [x] **Détection automatique** du format de fichier
- [x] **Affichage QDebug** - Debug complet des objets
- [x] **Gestion des ressources** - Fichiers intégrés à l'application

### Interface utilisateur

- [x] **Interface Master/Detail** - Liste + détails
- [x] **Mode édition/lecture** - Basculement sécurisé
- [x] **Recherche en temps réel** - Filtrage des recettes
- [x] **Gestion des modifications** - Sauvegarde/annulation
- [x] **Interface responsive** - Adaptation à la taille d'écran
- [x] **Interface traduisible** - Adaptation au langage utilisateur (anglais/français)

### Fonctionnalités métier

- [x] **CRUD recettes** - Création, lecture, modification, suppression
- [x] **Gestion des ingrédients** - Ajout/suppression dynamique
- [x] **Validation des données** - Contrôles de saisie
- [x] **Catégories prédéfinies** - Entrée, Plat, Dessert, Entremet, Soupe

### Persistance

- [x] **Sauvegarde XML** - Export des modifications
- [x] **Sauvegarde JSON** - Export au format JSON

### Interface avancée

- [x] **Thèmes visuels** - Dark/Light mode
- [x] **Aperçu des images** - Affichage des photos de recettes

## Technologies utilisées

- **Qt 6.x** - Framework d'interface graphique
- **C++17** - Langage de programmation
- **XML/JSON** - Formats de données
- **Qt Creator** - Environnement de développement

## Installation et compilation

### Prérequis

- Qt 6.x installé
- Compilateur C++17 compatible
- Qt Creator (recommandé)

### Étapes de compilation

1. **Cloner le projet**

   ```bash
   git clone [url-du-repository]
   cd S2_01
   ```

2. **Ouvrir dans Qt Creator**
   - Ouvrir `S2_01.pro`
   - Configurer le kit de compilation

3. **Compiler**
   - Build → Clean All
   - Build → Rebuild All

4. **Exécuter**
   - Run → Run (Ctrl+R)
