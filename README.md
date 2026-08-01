# Silver Taxi — Real Backend Setup

This replaces the localStorage mock database with a real backend:
**Node.js + Express + MongoDB**, deployed to **Render**, with a password-protected
driver dashboard (JWT login).

## What changed

- New `backend/` folder — a small Express API with three route groups:
  `/api/auth`, `/api/inquiries`, `/api/settings`
- `frontend/js/db.js` — no longer touches localStorage. It's now an API client
  that calls your backend. It keeps the same `window.TaxiDB.*` method names, so
  the rest of the site didn't need a rewrite, but every method is now `async`.
- `frontend/js/customer.js` and `frontend/js/owner.js` — updated to `await` the
  new async calls.
- `frontend/owner-login.html` — new. `owner.html` now redirects here if you're
  not logged in.
- `frontend/js/config.js` — new. One line, `API_BASE_URL`, pointing at your backend.
- Your `css/` and `images/` folders are untouched — just drop these files into
  your existing project folder, they don't conflict.

## 1. Set up MongoDB Atlas (free tier)

1. Go to https://www.mongodb.com/cloud/atlas/register and create a free account.
2. Create a free **M0 cluster**.
3. Under **Database Access**, add a database user with a username/password.
4. Under **Network Access**, add `0.0.0.0/0` (allow access from anywhere) —
   simplest option for a small app on Render's shared IPs.
5. Click **Connect > Drivers**, copy the connection string. It looks like:
   `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
6. Add a database name to it, e.g. `.../silver-taxi?retryWrites=true...`

## 2. Configure the backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:
- `MONGODB_URI` — the connection string from step 1
- `JWT_SECRET` — any long random string (e.g. run `openssl rand -hex 32`)
- `OWNER_USERNAME` — whatever username you want to log in with
- `FRONTEND_ORIGIN` — where your site will be hosted (see step 4). For local
  testing this can be `http://localhost:5500` or wherever you serve the HTML.

Generate your driver password hash:
```bash
node generate-hash.js "yourChosenPassword"
```
Copy the printed `OWNER_PASSWORD_HASH=...` line into `.env`.

Run it locally to test:
```bash
npm start
```
You should see `MongoDB connected` and `Server running on port 5000`.

## 3. Point the frontend at your backend

Edit `frontend/js/config.js`:
```js
window.API_BASE_URL = 'http://localhost:5000/api'; // while testing locally
```

Open `frontend/index.html` in a local server (not `file://` — use VS Code's
"Live Server" extension or `npx serve frontend`), submit a test booking, then
open `owner-login.html`, log in, and confirm it shows up.

## 4. Deploy the backend to Render

1. Push the `backend/` folder to a GitHub repo (can be the same repo as your
   frontend, Render just needs the path).
2. On https://render.com, click **New > Web Service**, connect your repo.
3. Settings:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
4. Add environment variables (same ones as your `.env`): `MONGODB_URI`,
   `JWT_SECRET`, `OWNER_USERNAME`, `OWNER_PASSWORD_HASH`, `FRONTEND_ORIGIN`.
5. Deploy. Render gives you a URL like `https://silver-taxi-backend.onrender.com`.

Note: Render's free tier spins down after inactivity — the first request after
a while can take ~30–60 seconds to wake up. Fine for a small business site;
upgrade to a paid instance later if that becomes annoying.

## 5. Deploy the frontend

Any static host works — Netlify, Vercel, GitHub Pages, or your own server.
Just make sure the whole `frontend/` folder (plus your existing `css/` and
`images/`) goes up together.

Before deploying, update `frontend/js/config.js` to point at your live Render URL:
```js
window.API_BASE_URL = 'https://silver-taxi-backend.onrender.com/api';
```

And update the backend's `FRONTEND_ORIGIN` env var on Render to match your
live frontend URL exactly (no trailing slash), so CORS allows it.

## 6. Log in

Go to `yoursite.com/owner-login.html` with the username/password you set in
step 2. `owner.html` will redirect here automatically if you're not logged in.

## Notes on how live updates work now

The old version used the browser's `storage` event, which only works between
tabs on the *same device*. Real data now lives in MongoDB, so the dashboard
polls the backend every 8 seconds for new inquiries — this works across any
device, anywhere. If you want instant (sub-second) updates instead of an
8-second delay later, that's a good next upgrade using WebSockets
(Socket.io), happy to add that when you're ready.
