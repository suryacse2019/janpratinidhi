# Janpratinidhi

An open source directory of India's elected representatives, election records, and public sources. The name means “people's representative”.

## Project status

Early MVP scaffold. Representative profiles are served from MongoDB and must be reviewed and published by an administrator. The repository does not bundle a complete national representative dataset.

## Stack

- React + TypeScript + Vite
- Node.js + Express + TypeScript
- MongoDB + Mongoose
- npm workspaces

## Run locally

1. Install Node.js 20 or newer and MongoDB (local or managed).
2. Copy `.env.example` to `apps/api/.env` and configure `MONGODB_URI`.
3. From the repository root run `npm install` and `npm run dev`.
4. Open http://localhost:5173. The API health endpoint is http://localhost:4000/api/health.

## Google sign-in and directory

Create a Google OAuth web client in Google Cloud Console and add both `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID` to `apps/api/.env` using its client ID (not the client secret). Vite is configured to read `apps/api/.env`; only `VITE_` variables are exposed to browser code. Set the authorized JavaScript origin to `http://localhost:5173`. Configure `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and a random `ADMIN_SESSION_SECRET` of at least 32 characters in `apps/api/.env`. The **Sign in with Google** flow is for regular users; first-time users must provide first name, last name, phone number, and gender before accessing `/dashboard`. The dashboard's **Find Your MP / MLA** feature requires a complete, active user account. It supports name, constituency, state, party, and MP/MLA filters, server-side pagination, and a detail page at `/representatives/:id`. The separate **Admin** header button opens `/admin/dashboard` and uses the admin email and password. Admin sessions expire after eight hours, and repeated failed logins are rate limited. The API verifies Google ID tokens and stores user profiles and account status in MongoDB. Admins can view users' submitted details, activate or deactivate accounts, and soft-delete accounts; inactive or deleted accounts cannot sign in. The admin dashboard includes tools to create, edit, publish, draft, or delete representative records, including photo and party symbol URLs, term/election information, source-backed records, and additional public record data. Admin API requests require a valid signed admin session. Representative data is not bundled: only published records entered and approved by an administrator appear in search. Add direct sources and verification dates for claims; the application does not invent representative details.

### Representative API

- `GET /api/representatives/search?q=&type=ALL|MP|MLA&state=&party=&page=1&limit=10` — authenticated with a Google bearer ID token; returns published records and pagination metadata.
- `GET /api/representatives/filters` — authenticated; returns available states and parties from published records.
- `GET /api/representatives/:id` — returns a published representative record for its details page.
- `GET /api/representatives` — existing public directory query endpoint.

The dashboard loads ten records per page. To try it locally, start MongoDB and the app with `npm run dev`, sign in with Google, complete the profile form, and open **Dashboard** → **Find Your MP / MLA**. Add and publish verified records from `/admin/dashboard` first; an empty published dataset correctly displays no results. Run `npm run typecheck` and `npm run build` for static validation.

## Data and attribution

Each published claim should have a source record with a direct URL and the date it was checked. Useful starting points include the [ECI affidavit portal](https://affidavit.eci.gov.in/) and [ECI statistical reports](https://www.eci.gov.in/statistical-reports). Respect source terms and copyright, particularly for photographs and bulk data. Code license does not grant rights to third-party data.

## Contributing

Please open an issue before large data imports. Include the original source, retrieval date, transformation steps, and any licensing restrictions. Never submit private credentials or personal data that is not already intentionally published by a reliable source.

## License

MIT for project code. Refer to individual source terms for contributed data and media.
