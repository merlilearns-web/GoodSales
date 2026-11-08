# CLAUDE.md

## Deployment

- This web app runs on **Railway**, not on the local computer.
- Railway deploys automatically from the `main` branch of this GitHub repo (`merlilearns-web/GoodSales`). Every push to `main` triggers a new deployment.

## Database

- The database is a **Railway PostgreSQL** database.
- It is available only through the `DATABASE_URL` environment variable on Railway. Always read the connection string from `DATABASE_URL`; never hard-code it.

## Local environment

- Do **not** set up a local database.
- Do **not** set up or run a local server.

## Workflow

1. Before every push, run `npm run build` and make sure the app builds without errors. Do not push a build that fails.
2. After each finished task, commit the changes and push to GitHub (`main`) so that Railway deploys the new version.
