# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Synchronisation Firebase vers Google Sheets

Le fichier Google Sheets est un miroir en lecture seule des donnees Firestore. Firestore reste la seule base principale.

Collections synchronisees:
- `membres`
- `transactions`
- `evenements`
- `presences`
- `users` est lu pour les statuts/roles, mais ne declenche pas la synchro.

Onglets geres automatiquement:
- `OVERVIEW`
- `MEMBRES`
- `BUDGET`
- `BUDGET_MENSUEL`
- `BUDGET_ANNUEL`
- `PRESENCES`
- `PRESENCES_DETAIL`
- `LOG_SYNC`

### Configuration Google Cloud

1. Dans Google Cloud Console, ouvrir le projet Firebase `yfc-budget`.
2. Activer `Google Sheets API`.
3. Creer un Service Account, par exemple `yfc-sheets-sync`.
4. Creer une cle JSON pour ce Service Account.
5. Copier l'email du Service Account.
6. Ouvrir le Google Sheet et le partager avec cet email en role `Editeur`.
7. Garder le fichier protege: les utilisateurs normaux doivent rester en lecture seule.

### Secrets Firebase Functions

Configurer les secrets sans les mettre dans le frontend:

```bash
firebase functions:secrets:set GOOGLE_SHEET_ID
firebase functions:secrets:set GOOGLE_SERVICE_ACCOUNT_EMAIL
firebase functions:secrets:set GOOGLE_PRIVATE_KEY
```

Valeurs attendues:

```bash
GOOGLE_SHEET_ID=1bmvdcxi8NS4_RTPPT4cXusAVMgORMqB08RtxvNBOqz8
GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Ne jamais committer ces valeurs. `.env` et `.env.*` sont deja ignores par Git.

### Deploiement

```bash
firebase deploy --only functions
```

Les fonctions exposees pour l'Admin:
- `prepareGoogleSheets`: prepare les onglets, en-tetes, styles, filtres et protections.
- `syncAllToGoogleSheets`: lance une synchronisation complete.

Les triggers Firestore relancent une synchro apres modification sur:
- `membres/{docId}`
- `transactions/{docId}`
- `evenements/{docId}`
- `presences/{docId}`

### Premiere synchronisation

Dans l'app, ouvrir `Administration`, puis:
1. Cliquer `Preparer`.
2. Cliquer `Synchroniser`.
3. Verifier l'onglet `LOG_SYNC`.

Acces autorise:
- Admin principal
- President
- Vice president
- Responsable financier
- Tresorier
