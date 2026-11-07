# Ambassadeurs Epicure · UNUSUALL

Plateforme du programme Ambassadeurs Epicure : présentation de l'offre (gains, avantages, niveaux, charte, FAQ) et formulaire de candidature.

Site statique, sans dépendance : `index.html`, `assets/style.css`, `assets/app.js`, images dans `assets/img/`.

## Adresse prévue

`https://ambassadeurs.unusuall.online` (déclarée dans le fichier `CNAME`, les balises `canonical` et `og:url`, `robots.txt` et `sitemap.xml`). Pour changer d'adresse, remplacer ces cinq occurrences.

## Mise en ligne avec GitHub Pages

1. Créer un dépôt sur GitHub (par exemple `unusuall-ambassadeurs`) et y pousser ce dossier.
2. Dans le dépôt : **Settings → Pages → Build and deployment → Source : Deploy from a branch**, branche `main`, dossier `/ (root)`.
3. Toujours dans **Pages**, champ **Custom domain** : `ambassadeurs.unusuall.online` (déjà présent grâce au fichier `CNAME`).
4. Chez LWS, dans la zone DNS de `unusuall.online`, ajouter un enregistrement **CNAME** : nom `ambassadeurs`, valeur `<votre-compte-github>.github.io.`
5. Une fois le DNS propagé (quelques minutes à quelques heures), cocher **Enforce HTTPS** dans les réglages Pages.

## Formulaire de candidature

Les candidatures passent par Formspree (`https://formspree.io/f/xzdqanqq`, le même formulaire que la page Contact d'unusuall.online), avec l'objet « [Ambassadeur Epicure] Nouvelle candidature ». Si ce formulaire Formspree limite les domaines autorisés, ajouter `ambassadeurs.unusuall.online` dans ses réglages.

## Modifier les montants

Les prix des formules et les taux (30 % puis 10 % du 3e au 12e mois) apparaissent dans `index.html` (tableau, chiffres clés, encadrés) et dans `assets/app.js` (objet `PLANS` du simulateur).

Après une modification du CSS ou du JS, augmenter le numéro `?v=` dans `index.html`.
