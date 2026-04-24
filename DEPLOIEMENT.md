# FX Manager — Guide de déploiement

## Structure des fichiers à créer

```
fx-manager/
├── src/
│   ├── App.js          ← remplacer avec App.js fourni
│   ├── supabaseClient.js ← nouveau fichier à créer
│   └── index.js        ← laisser intact
├── package.json        ← modifier (voir ci-dessous)
└── .gitignore          ← laisser intact
```

---

## Étape 1 — Installer les dépendances

Dans le Terminal, dans le dossier du projet :

```bash
npm install @supabase/supabase-js
```

---

## Étape 2 — Copier les fichiers

1. Remplacez le contenu de `src/App.js` par le fichier `App.js` fourni
2. Créez le fichier `src/supabaseClient.js` avec le contenu fourni

---

## Étape 3 — Tester en local

```bash
npm start
```

L'application s'ouvre sur http://localhost:3000
Testez en ouvrant deux onglets : un en prof (PIN: PROF2024) et un en équipe.

---

## Étape 4 — Pousser sur GitHub

```bash
git init
git add .
git commit -m "FX Manager initial"
git branch -M main
git remote add origin https://github.com/VOTRE_USERNAME/fx-manager.git
git push -u origin main
```

---

## Étape 5 — Déployer sur Vercel

1. Allez sur vercel.com → "New Project"
2. Importez votre repo GitHub fx-manager
3. Cliquez "Deploy" (tout est auto-détecté)
4. Votre URL permanente : https://fx-manager.vercel.app

---

## Code PIN professeur : PROF2024
