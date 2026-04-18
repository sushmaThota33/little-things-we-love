# Little Things We Love — multi-couple edition

A note-keeping app where couples write little things they love about each other and unlock them together each month. Updated from the original single-couple version with:

- Email + password registration / login (JWT-based)
- Multiple couples on the same deployment, each with their own private space
- Couples are formed via a one-time invitation link (a couple has up to 2 members)
- A separate Express backend (instead of the browser talking directly to Supabase)
- A new database schema scoped by `couple_id`
- 100% free hosting — Vercel for frontend + serverless API, Supabase free tier for Postgres

## Tech stack (all free)

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | React 18 + Vite + React Router | Same as before, lighter setup |
| Backend | Node.js + Express, deployed as a Vercel serverless function | One project, one deploy |
| DB | Supabase Postgres (free tier) | You already use it; the browser no longer touches it directly |
| Auth | JWT (HS256) + bcrypt password hashing | No third-party dependency |

## Folder layout

```
little-things-we-love/
├── api/                  # Express app, becomes a Vercel serverless function
│   ├── index.js          # entry point — exports `app` as default
│   ├── routes/
│   │   ├── auth.js       # /api/auth/{register,login,me}
│   │   ├── couples.js    # /api/couple/{create,invite,accept,me}
│   │   └── entries.js    # /api/entries (GET, POST, /unlock-month)
│   ├── middleware/
│   │   └── auth.js       # JWT verification + couple gating
│   └── lib/
│       ├── supabase.js   # service-role client (server only)
│       └── jwt.js
├── src/                  # React app (Vite)
│   ├── App.jsx           # the notes view
│   ├── main.jsx          # router setup
│   ├── index.css
│   ├── lib/
│   │   ├── api.js        # fetch wrapper that injects the JWT
│   │   └── auth.jsx      # AuthContext + useAuth()
│   └── pages/
│       ├── Login.jsx
│       ├── Register.jsx
│       ├── SetupCouple.jsx
│       └── AcceptInvite.jsx
├── database/
│   └── schema.sql        # run this once in the Supabase SQL editor
├── index.html
├── package.json
├── vite.config.js
├── vercel.json
├── .env.example
└── README.md
```

(The empty `frontend/` and `backend/` folders left over from the first scaffold can be deleted.)

## 1. Set up Supabase

1. Create a Supabase project (free tier).
2. Open the SQL editor and paste / run the contents of [`database/schema.sql`](database/schema.sql).
3. In **Project Settings → API**, copy:
   - `URL` → `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret — server-side only)

> The browser no longer talks to Supabase. Only the backend uses the service-role key, so RLS isn't required. All couple-scoping is enforced in the API layer.

## 2. Local development

```bash
cp .env.example .env
# edit .env with your Supabase URL, service-role key, and a JWT_SECRET
# (generate one with: openssl rand -base64 48)

npm install
npm run dev:api   # terminal 1 — Express on http://localhost:3001
npm run dev       # terminal 2 — Vite on http://localhost:5173
```

Vite proxies `/api/*` to `http://localhost:3001`, so the frontend code can use plain relative URLs (`/api/auth/login` etc.) in both dev and production.

### Smoke test

```bash
curl http://localhost:5173/api/health
# → {"ok":true,"ts":...}
```

## 3. Deploy to Vercel

1. Push this folder to a new GitHub repo.
2. In Vercel: **Add New → Project → Import** that repo.
3. Vercel auto-detects Vite. Leave the build settings as-is.
4. In **Settings → Environment Variables**, add:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `JWT_SECRET`
   - (optional) `CORS_ORIGIN` if you want to lock the API to a specific origin
5. Click **Deploy**.

`vercel.json` rewrites `/api/*` to the `api/index.js` serverless function and serves the SPA for everything else.

## 4. Invitation flow

1. Person A registers → lands on `/setup` → clicks **Create our space**.
2. App generates an invite link like `https://your-app.vercel.app/invite/<token>` (good for 7 days).
3. Person A sends the link to Person B.
4. Person B opens the link → app prompts them to register / log in → they're added to the couple.
5. Both partners now see the same notes from then on. Notes written before B joined are still visible (entries are couple-scoped at write time, but B is now a member of that couple).

A couple is capped at 2 members. The cap is enforced both at the DB level (trigger on `couple_members`) and in the API.

## 5. Migration from the old single-couple app

The schema is incompatible with the old one (the old `entries` table had `writer` as free text and no `couple_id`). If you have data in the old database that you want to bring over:

```sql
-- After running the new schema.sql:

-- 1. Insert the two original people as users (set hashed passwords manually or
--    have them re-register and then UPDATE their user_id below).
INSERT INTO users (id, email, password_hash, display_name) VALUES
  ('00000000-0000-0000-0000-00000000aaaa', 'bujji@example.com', '$2a$10$placeholder', 'Bujji'),
  ('00000000-0000-0000-0000-00000000bbbb', 'kanna@example.com', '$2a$10$placeholder', 'Kanna');

-- 2. Create the original couple
INSERT INTO couples (id, name, created_by)
VALUES ('00000000-0000-0000-0000-0000000000c1', 'Bujji & Kanna', '00000000-0000-0000-0000-00000000aaaa');

INSERT INTO couple_members (couple_id, user_id) VALUES
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000aaaa'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000bbbb');

-- 3. Copy the old entries (assumes the old table is renamed to entries_old)
INSERT INTO entries (couple_id, user_id, text, written_month, unlock_date, month_unlocked, created_at)
SELECT
  '00000000-0000-0000-0000-0000000000c1',
  CASE WHEN writer = 'Bujji'
       THEN '00000000-0000-0000-0000-00000000aaaa'
       ELSE '00000000-0000-0000-0000-00000000bbbb' END,
  text, written_month, unlock_date, COALESCE(month_unlocked, false), created_at
FROM entries_old;
```

Tell each person to register with the email above, then `UPDATE users SET password_hash = ... WHERE email = ...` so it matches their bcrypt hash, OR have them register with new emails and just update the `user_id` columns to match.

If you don't have important data, the cleanest thing is to drop the old tables and start fresh.

## 6. Security notes

- Passwords are hashed with bcrypt (`bcryptjs`, 10 rounds). Plain passwords are never stored or logged.
- JWTs are HS256, signed with `JWT_SECRET`, valid for 30 days. Stored in `localStorage`. If you'd prefer httpOnly cookies, swap `setToken`/`getToken` and add `cookie-parser` + `Set-Cookie` in the auth routes.
- Note bodies are **never returned by the API** until the month has been explicitly unlocked. The locked-month preview only includes `unlock_date` + count.
- Invitation tokens are 24 random bytes (base64url), good for 7 days, single-use.
- Couple membership is unique per user (DB unique index) and capped at 2 (DB trigger + API check).

## 7. Things you can extend

- Magic-link login (Resend free tier, 3K/month)
- Google sign-in (Supabase Auth or your own OAuth route)
- Push reminders on the 3rd of each month
- A "couple name + avatar" customization page
- Soft-delete / undo for notes
