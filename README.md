# Jan Pratinidhi

An open directory of India's elected representatives, election records, and public sources. **Jan Pratinidhi** means “people's representative.”

- **Website:** https://janpratinidhi.vercel.app
- **Source code:** https://github.com/suryacse2019/janpratinidhi

> **Project status:** Early MVP. The directory is a work in progress and does not yet contain a complete national dataset. Records must be reviewed and published by an administrator before appearing in the public directory.

## What it does

- Search published MP and MLA profiles by name, constituency, state, and party.
- View representative details, election information, and linked public sources.
- Sign in with Google and save an MP and MLA to a user dashboard.
- Manage user accounts and representative records through a separate admin area.

## Technology

- React, TypeScript, and Vite
- Node.js, Express, and TypeScript
- MongoDB and Mongoose
- npm workspaces

## Run locally

### Requirements

- Node.js 20 or newer
- npm
- A local MongoDB server or a MongoDB Atlas database

### Install and configure

1. Clone the repository and enter its directory:

   ```sh
   git clone https://github.com/suryacse2019/janpratinidhi.git
   cd janpratinidhi
   ```

2. Install dependencies from the repository root:

   ```sh
   npm install
   ```

3. Copy `.env.example` to `apps/api/.env` and replace the example values. Do not commit this file.

4. Start the API and website:

   ```sh
   npm run dev
   ```

5. Open http://localhost:5173. The API health endpoint is http://localhost:4000/api/health.

The Vite app reads local environment variables from `apps/api/.env`. Only variables prefixed with `VITE_` are exposed to browser code. Never put passwords, database credentials, or private keys in a `VITE_` variable.

## Environment variables

| Variable | Used by | Description |
| --- | --- | --- |
| `MONGODB_URI` | API | MongoDB connection string. |
| `GOOGLE_CLIENT_ID` | API | Google OAuth web client ID used to verify sign-in credentials. |
| `VITE_GOOGLE_CLIENT_ID` | Website | The same Google OAuth web client ID, used by Google Identity Services in the browser. |
| `CLIENT_ORIGIN` | API | Website origin allowed by CORS, for example `http://localhost:5173`. |
| `ADMIN_EMAIL` | API | Email address for the separate admin login. |
| `ADMIN_PASSWORD` | API | Strong, unique password for the admin login. |
| `ADMIN_SESSION_SECRET` | API | Random secret of at least 32 characters used to sign admin sessions. |
| `VITE_API_URL` | Website | API base URL, including `/api`. Defaults to the production API URL in production and `http://localhost:4000/api` locally. |
| `PORT` | API | Local API port. Defaults to `4000`. |

### Google sign-in

Create a Google OAuth client with application type **Web application**. Add your website origins under **Authorized JavaScript origins**:

- Local: `http://localhost:5173`
- Production: `https://janpratinidhi.vercel.app`

Set `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID` to the same client ID. A client ID is intended to be used by the browser; do not use or publish the client secret in frontend code.

## Deploy on Vercel

This repository is a monorepo, so create a separate Vercel project for each app, both connected to this GitHub repository:

1. Create the **website** project with Root Directory `apps/web`. Use the Vite framework preset and output directory `dist`.
2. Create the **API** project with Root Directory `apps/api`. The API exports its Express application for Vercel Functions.
3. Add the required environment variables in each project's **Settings → Environment Variables**. Set `VITE_API_URL` and `VITE_GOOGLE_CLIENT_ID` on the website project; set `MONGODB_URI`, `GOOGLE_CLIENT_ID`, `CLIENT_ORIGIN`, and the admin variables on the API project.
4. Use a hosted MongoDB database reachable by Vercel. Do not use `localhost` for the production `MONGODB_URI`.
5. Set `CLIENT_ORIGIN` to the production website origin, then redeploy both projects after changing environment variables.

The `VITE_` values are included in the website bundle at build time. Changes to them require a new website deployment.

## API overview

The API base path is `/api`.

| Method and path | Purpose |
| --- | --- |
| `GET /api/health` | API health check. |
| `GET /api/representatives` | Public, paginated published directory. |
| `GET /api/representatives/directory-filters` | Public state and party filters. |
| `GET /api/representatives/:id` | Published representative details. |
| `GET /api/representatives/:id/external-profile` | Matched public profile information from external sources. |
| `GET /api/representatives/search` | Authenticated representative search. |
| `GET /api/representatives/filters` | Authenticated directory filters. |
| `POST /api/auth/google` | Verify Google sign-in and create or retrieve a user account. |
| `POST /api/auth/complete-profile` | Save required first-login profile details. |

Authenticated endpoints require a Google ID token in the `Authorization: Bearer <token>` header. Admin endpoints are under `/api/admin` and require a valid admin session.

## Data quality and attribution

This project aims to make civic information easier to explore, not to replace official records. Published claims should include a direct source and the date that source was checked. Verify names, offices, constituencies, election results, and dates against authoritative sources.

The code license does not grant rights to third-party datasets, photographs, party symbols, or other media. Check the terms and attribution requirements for every external source and contributed asset before publishing it. Avoid collecting or publishing private personal information.

The website records an approximate daily unique-visitor count using a random first-party browser identifier that rotates each UTC day. The API stores only a hash of that daily identifier and the date; it does not store visitor IP addresses or names for this metric. Counts are approximate: clearing browser storage, using another browser/device, or blocking analytics can affect the total. Visit records expire after 90 days. For signed-in users, the admin panel also records account activity such as sign-ins, page views, directory searches (without search text), and saved-representative changes. Page names appear once per account, with repeat visits updating the last-visited time. Activity records are visible only to admins and expire after 90 days; keystrokes and arbitrary clicks are not recorded.

## Contributing

Contributions are welcome, including code, documentation, accessibility improvements, and carefully sourced corrections.

### Contribute a code or documentation change

1. **Pick a task.** Browse the repository's open issues or create an issue describing the bug or improvement you want to work on. For a large change, discuss the approach in an issue first.
2. **Fork the repository.** On GitHub, open [Jan Pratinidhi](https://github.com/suryacse2019/janpratinidhi) and select **Fork**. This creates a copy under your GitHub account.
3. **Clone your fork and install dependencies:**

   ```sh
   git clone https://github.com/YOUR-GITHUB-USERNAME/janpratinidhi.git
   cd janpratinidhi
   npm install
   ```

4. **Create a branch** for your change:

   ```sh
   git checkout -b describe-your-change
   ```

5. **Make your change.** Keep it focused. For local development, copy `.env.example` to `apps/api/.env` and fill in your own development values. Never commit this file, credentials, or private user information.
6. **Run the project checks** from the repository root:

   ```sh
   npm run typecheck
   npm run build
   ```

7. **Commit and push your branch** to your fork:

   ```sh
   git add .
   git commit -m "Describe your change"
   git push -u origin describe-your-change
   ```

8. **Open a pull request.** On GitHub, use **Compare & pull request** to propose your branch for merging into the original repository. Explain what changed and why. Include screenshots for visual changes and links to sources for factual or data changes. A maintainer will review it and may request revisions.

### Suggest a data correction or contribute records

Open an issue with the representative's name, the field to correct, the proposed correction, and a direct source URL with the date you checked it. Before a large data import, open an issue describing the original source, retrieval date, transformation steps, and any licensing restrictions. Do not submit private personal information or material you do not have permission to redistribute.

Never include credentials, private user data, or secrets in issues, commits, or pull requests.

## License

The project code is licensed under the [MIT License](LICENSE). Third-party data and media remain subject to their own licenses and source terms.
