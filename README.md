# TD Detailed Booking App

## Local Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy To Firebase Hosting (Manual)

```bash
npm run deploy:hosting
```

This deploys the built app to Firebase Hosting project `tddetailed-dtatabase`.

## Auto Deploy On Push To Main

This repo is configured with GitHub Actions to deploy Firebase Hosting on each push to `main`:

- Workflow file: `.github/workflows/firebase-hosting-deploy.yml`
- Firebase project: `tddetailed-dtatabase`
- Hosting channel: `live`

### One-Time GitHub Secret Setup

1. Generate a Firebase service account JSON key with Hosting deploy permissions.
2. In GitHub repo settings, add this Actions secret:
	- `FIREBASE_SERVICE_ACCOUNT_TDDETAILED_DTATABASE`
3. Paste the full JSON key as the secret value.

After this, every push to `main` will build and deploy automatically.

## Domain

No custom domain wiring is required for this setup. You can connect your domain later from Firebase Hosting settings.
