# Ambassadeurs UNUSUALL

Plateforme du programme Ambassadeurs UNUSUALL : les ambassadeurs choisissent les produits qu'ils représentent (Epicure pour l'instant ; Suite SOFIA et OMI à venir), découvrent leurs gains et avantages, et postulent.

Même canevas et même style que [unusuall.online](https://unusuall.online) : barre du haut, dock, fenêtre, pied de page et barre mobile.

## Pages

| Fichier | Contenu |
|---|---|
| `index.html` | Le programme : accroche, chiffres clés, 4 étapes, produits |
| `produits.html` | Les produits à représenter (Epicure ouvert, les autres bientôt) |
| `gains.html` | Règles de commission, tableau Epicure, simulateur |
| `avantages.html` | Avantages, 3 niveaux, charte |
| `postuler.html` | Formulaire de candidature et FAQ |

## Modifier le contenu

Les pages sont générées par `scripts/build-pages.mjs`, qui contient le cadre commun et le texte de chaque page. Après une modification :

```bash
node scripts/build-pages.mjs
```

- `src/site.css` : copie du style de unusuall.online (la recopier depuis le site si son style évolue).
- `src/ambassadeurs.css` : les éléments propres à la plateforme.
- `assets/css/app.css` : fichier final, généré par `node scripts/build-css.mjs` (règles inutilisées retirées, compressé). Ne pas le modifier à la main.
- `assets/js/app.js` : thème, horloge, dock, apparitions, simulateur et formulaire.
- Après une modification des pages ou de `src/`, relancer `node scripts/build-css.mjs` (le nettoyage dépend des classes utilisées dans les pages), puis augmenter `V` dans `scripts/build-pages.mjs` et régénérer les pages.

**Ajouter un produit** : dans `scripts/build-pages.mjs`, passer sa carte de « Bientôt » à « Ouvert » (pages Programme et Produits), ajouter son tableau dans Gains, et activer sa case dans le formulaire de Postuler.

## Formulaire

Les candidatures passent par Formspree (`https://formspree.io/f/xzdqanqq`, le même formulaire que la page Contact d'unusuall.online), avec l'objet « [Ambassadeur UNUSUALL] Nouvelle candidature ». Si ce formulaire limite les domaines autorisés, y ajouter `ambassadeurs.unusuall.online`.

## Mise en ligne (GitHub Pages)

1. Dans le dépôt GitHub : **Settings → Pages → Source : Deploy from a branch**, branche `main`, dossier `/ (root)`.
2. **Custom domain** : `ambassadeurs.unusuall.online` (déjà dans le fichier `CNAME`).
3. Chez LWS, zone DNS de `unusuall.online` : ajouter un **CNAME** nommé `ambassadeurs` pointant vers `<compte-github>.github.io.`
4. Une fois le DNS actif, cocher **Enforce HTTPS**.
