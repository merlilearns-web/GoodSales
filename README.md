# GoodSales

Early-stage sales leads for the Estonian construction and architecture B2B sector, built from
Ehitisregister (EHR) "Projekteerimistingimuste taotlus" exports. The UI is entirely in Estonian.

## Stack

- Next.js 16 (App Router, TypeScript), React 19, Tailwind CSS 4, lucide-react
- SheetJS (`xlsx`) for server-side Excel parsing
- Railway PostgreSQL (`DATABASE_URL`) for the shared, admin-managed dataset
- localStorage for per-browser favorites and an offline copy of the dataset

## Features

- **Public view:** search (building name / address, diacritic-insensitive), multi-select filters for
  maakond, regioon, ehitise tüüp and seisund, a date range with quick presets, sorting, and an
  "All leads" / "Saved" view switcher.
- **Lead cards:** status badge, favorite star, details grid, an "Ava EHR-is" link to the EHR document
  search, and a copy button for the EHR code.
- **CSV export** of the filtered results or of all favorites (semicolon-separated UTF-8 with BOM, so it
  opens correctly in Excel with Estonian locale settings).
- **Admin (`/haldus`)**, password protected: dataset metadata, upload a new `.xlsx` to replace the
  dataset for every visitor, restore the bundled default file, or clear the dataset. Other visitors
  pick up changes within 60 seconds, or immediately when they return to the tab.
- **Mobile / PWA:** hamburger menu, slide-over filter drawer, single-column cards, touch targets of
  at least 44px, a web app manifest and install icons.

## Data

The default dataset is the first `.xlsx` file in `public/` (override it with `DEFAULT_DATASET_FILE`).
The parser picks the sheet whose header row matches the most known columns and maps:

| Excel column        | Field          |
| ------------------- | -------------- |
| Dokumendi kuupäev   | `date`         |
| EHR kood            | `ehrCode`      |
| Dokumendi number    | `docNumber`    |
| Dokumendi liik      | `docType`      |
| Ehitise nimetus     | `buildingName` |
| Ehitise aadress     | `address`      |
| Maakond             | `county`       |
| Regioon             | `region`       |
| Seisund             | `status`       |
| Menetlev asutus     | `authority`    |

`Ehitise nimetus` is free text, so `src/lib/categories.ts` groups it into categories (Üksikelamu,
Korterelamu, Ladu, Viilhall / tootmishoone, …) for the type filter.

When an admin uploads a file or clears the dataset, the result is stored in the
`goodsales_dataset` table, which is created automatically. Restoring the default deletes that row.
Without `DATABASE_URL`, admin changes live only in server memory.

## Environment variables

See `.env.example`.

| Variable               | Purpose                                                   |
| ---------------------- | --------------------------------------------------------- |
| `ADMIN_PASSWORD`       | Admin password (default `admin123`; **set this on Railway**) |
| `ADMIN_SECRET`         | Optional secret used to sign the admin session cookie      |
| `DATABASE_URL`         | Railway PostgreSQL connection string                      |
| `DEFAULT_DATASET_FILE` | Optional default `.xlsx` file name in `public/`           |

## Deployment

Railway builds and deploys automatically from the `main` branch (`npm run build`, then `npm start`).
The app always listens on port 3000 (`0.0.0.0`), so the Railway public domain's target port must be 3000.
Run `npm run build` before every push.
