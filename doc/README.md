# Cancellation Monitoring System

A full-stack web application for monitoring and managing POS cancellation requests, asset inventory, operator management, and announcements.

## Tech Stack

| Layer    | Technology                       | Hosting      |
| -------- | -------------------------------- | ------------ |
| Frontend | React 19, Vite 8, Tailwind CSS 4 | **Vercel**   |
| Backend  | Express 5, Node.js               | **Render**   |
| Database | PostgreSQL (via Supabase)        | **Supabase** |

## Project Structure

```
cancellation-monitoring-system/
├── frontend/              # React + Vite SPA
│   ├── src/               # Application source
│   └── vercel.json        # Vercel SPA routing config
├── backend/               # Express API server
│   ├── src/
│   │   ├── config/        # DB connection, init scripts
│   │   ├── routes/        # API route handlers
│   │   └── public/uploads/ # Uploaded media
│   ├── server.js          # Entry point
│   └── package.json
├── doc/                   # Documentation
└── package.json           # Root workspace (pnpm workspaces)
```

---

## 1. Database — Supabase

### Steps

1. **Create a Supabase project** at [supabase.com](https://supabase.com).
2. Go to **Project Settings > Database** and copy the **Connection string** (Pooling mode).
   - It looks like: `postgresql://postgres.[project-ref]:[password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`
3. Open the **SQL Editor** in the Supabase dashboard and run the migration script:
   ```
   doc/SUPABASE_MIGRATION.sql
   ```
   This creates all required tables, indexes, and seed data.

> **Note:** Supabase's free tier auto-pauses projects after inactivity. The backend has built-in retry logic (up to ~2.5 minutes) to wait for the database to wake up.

---

## 2. Backend — Render

### Prerequisites

- A [Render](https://render.com) account
- Your Supabase database connection string from step 1

### Steps

1. In Render dashboard, click **New + > Web Service**.
2. Connect your GitHub repository (or use manual deploy).
3. Configure the service:

   | Setting            | Value                                 |
   | ------------------ | ------------------------------------- |
   | **Name**           | `cancellation-monitoring-backend`     |
   | **Root Directory** | `backend`                             |
   | **Build Command**  | `npm install`                         |
   | **Start Command**  | `node server.js`                      |
   | **Plan**           | Free (or paid for better performance) |

4. Add the required **Environment Variables** (under the **Environment** section):

   | Variable       | Value                                                                             |
   | -------------- | --------------------------------------------------------------------------------- |
   | `DATABASE_URL` | Your Supabase pooling connection string                                           |
   | `PORT`         | `10000` (Render injects this automatically — leave blank to use Render's default) |

5. Click **Create Web Service**.

6. Once deployed, note your backend URL:
   ```
   https://cancellation-monitoring-backend.onrender.com
   ```

### Health Check

After deployment, verify the backend is running:

```bash
curl https://cancellation-monitoring-backend.onrender.com/api/health
```

Expected response:

```json
{ "status": "ok", "db": { "status": "ok" } }
```

---

## 3. Frontend — Vercel

### Prerequisites

- A [Vercel](https://vercel.com) account
- Your Render backend URL from step 2

### Steps

1. In Vercel dashboard, click **Add New > Project**.
2. Import your GitHub repository.
3. Configure the project:

   | Setting              | Value           |
   | -------------------- | --------------- |
   | **Root Directory**   | `frontend`      |
   | **Build Command**    | `npm run build` |
   | **Output Directory** | `dist`          |
   | **Framework Preset** | Vite            |

4. Add the required **Environment Variable**:

   | Variable       | Value                                                  |
   | -------------- | ------------------------------------------------------ |
   | `VITE_API_URL` | `https://cancellation-monitoring-backend.onrender.com` |

   > **Important:** Do NOT include a trailing slash. This variable tells the frontend where to send API requests. In development mode (local), the Vite proxy handles this automatically — see `frontend/vite.config.ts`.

5. Click **Deploy**.

### SPA Routing

The `frontend/vercel.json` file rewrites all routes to `index.html` so that React Router handles navigation — no extra configuration needed.

### Custom Domain (Optional)

1. Go to your Vercel project **Settings > Domains**.
2. Add your custom domain and update your DNS records as instructed by Vercel.
3. Update `VITE_API_URL` to reflect the custom domain or keep it pointing to Render.

---

## Local Development

### Prerequisites

- Node.js 20+
- pnpm (install via `npm install -g pnpm`)
- A running Supabase database (or local PostgreSQL)

### Setup

```bash
# Install all dependencies (root + frontend + backend)
pnpm install

# Create backend/.env with:
DATABASE_URL=postgresql://...
PORT=5050

# Start both frontend and backend concurrently
pnpm dev
```

- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:5050
- The Vite dev server proxies `/api/*` requests to the backend (see `frontend/vite.config.ts`).

---

## Environment Variables Summary

| Variable       | Where    | Required | Description                           |
| -------------- | -------- | -------- | ------------------------------------- |
| `DATABASE_URL` | Backend  | ✅       | Supabase PostgreSQL connection string |
| `PORT`         | Backend  | ❌       | Server port (default: 5050)           |
| `VITE_API_URL` | Frontend | ✅       | Backend URL for production API calls  |

---

## Troubleshooting

### Backend shows "database_unavailable"

- Supabase free-tier databases auto-pause after ~1 week of inactivity. The backend retries for ~2.5 minutes — wait and refresh.
- Check the `DATABASE_URL` environment variable is correct.
- Verify the Supabase project has not been paused (wake it by visiting the Supabase dashboard).

### Frontend returns blank page or 404

- Ensure `VITE_API_URL` is set correctly in Vercel environment variables.
- Redeploy the frontend after changing environment variables.
- Check Vercel deployment logs for build errors.

### Uploaded media (images) not showing

- The backend serves uploaded files from `/uploads/`.
- On Render free tier, uploaded files are ephemeral and will be lost on restart. For persistent storage, configure a cloud storage service (e.g., Supabase Storage, AWS S3, Cloudinary).

### CORS errors

- The backend uses `cors()` middleware (all origins allowed). If you need to restrict origins, update the CORS configuration in `backend/server.js`.
