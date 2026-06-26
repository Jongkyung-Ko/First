# First — Digital World Portal

A single-page website with email/password sign-in powered by Supabase.

- **Top (10%)** — Welcome header (shows logged-in user)
- **Left (20%)** — Menu: Welcome, Board, Sign-in, Sign-up, About
- **Right (80%)** — Detail content (default: Welcome to Digital World)

## Live site

https://jongkyung-ko.github.io/First/

## Supabase setup (one-time)

1. Create a free account at [supabase.com](https://supabase.com).
2. Create a new project (e.g. `digital-world`).
3. Open **Authentication → Providers** and ensure **Email** is enabled.
4. Open **Project Settings → API** and copy:
   - **Project URL**
   - **anon public** key
5. Paste those values into [`js/config.js`](js/config.js):

```javascript
window.SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
window.SUPABASE_ANON_KEY = "YOUR_ANON_KEY";
```

6. Open **SQL Editor** in Supabase and run the script in [`supabase/profiles.sql`](supabase/profiles.sql). This creates the `profiles` table and Row Level Security policies.

7. Run [`supabase/delete_account.sql`](supabase/delete_account.sql) in **SQL Editor** to enable account deletion from the **Sign-out** menu.

8. Run [`supabase/setup_board.sql`](supabase/setup_board.sql) in **SQL Editor** for the **Board** (posts table + image storage).  
   Or run [`supabase/posts.sql`](supabase/posts.sql) and [`supabase/storage.sql`](supabase/storage.sql) separately.

9. Run [`supabase/master.sql`](supabase/master.sql) for **Master** admin access (view all users).

10. Run [`supabase/master_posts.sql`](supabase/master_posts.sql) so **Master** can edit and delete any board post.

11. Run [`supabase/posts_author_email.sql`](supabase/posts_author_email.sql) to store author email as board post ID.

### Master account

- Click **Master** (top right) → sign in with password **123456**
- Email: `master@digitalworld.local` (auto-created on first login)
- For testing, turn off **Confirm email** in Supabase so master login works immediately.

### Email confirmation (required)

Enable email confirmation in Supabase:

1. **Authentication → Providers → Email**
2. Turn **ON** → **Confirm email**
3. Save

Also set **Authentication → URL Configuration**:

- **Site URL:** `https://jongkyung-ko.github.io/First/`
- **Redirect URLs:** `https://jongkyung-ko.github.io/First/**`

After sign-up, users receive a confirmation email. Clicking the link returns them to the site and signs them in automatically.

If email does not arrive, use **Resend confirmation email** on the sign-up page, or check spam. Supabase free tier limits how many emails can be sent per hour.

## How auth works

```text
Browser (GitHub Pages)  →  Supabase Auth  →  PostgreSQL (auth.users + profiles)
```

- **Sign-up** creates a user in Supabase (password is hashed; never stored in this repo).
- **Sign-in** verifies email/password and keeps a session in the browser.
- **Profiles** stores display name and email in the `profiles` table.

## Board

- **Board** — anyone can read posts; list shows title, date, author ID (email), and image thumbnail
- **Write Post** — signed-in users can post with optional image and current location (map)
- Authors can **edit** or **delete** their own posts; Master can manage any post
- Images stored in Supabase Storage (`post-images` bucket)
- Maps use [Leaflet](https://leafletjs.com/) + OpenStreetMap

## Local testing

### Option A: start-server.bat (recommended)

Double-click [`start-server.bat`](start-server.bat) or run it from a terminal.

- Opens **http://localhost:8080/First/** (same `/First/` path as GitHub Pages)
- Uses Python built-in HTTP server via [`serve.py`](serve.py)

For Supabase email confirmation locally, also add to **Authentication → URL Configuration → Redirect URLs**:

- `http://localhost:8080/First/**`

### Option B: open file directly

1. Complete Supabase setup above.
2. Open `index.html` in a browser (scripts load with `./` base path).
3. Use **Sign-up** to create an account, then **Sign-in**.

## GitHub Pages

The site is deployed from the `main` branch. After updating `js/config.js`, commit and push — GitHub Pages will serve the updated site automatically.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Layout, menu, sign-in/sign-up forms |
| `js/config.js` | Supabase URL and anon key |
| `js/auth.js` | Sign-up, sign-in, sign-out, session handling |
| `js/board.js` | Board list, post detail, image upload, map |
| `supabase/profiles.sql` | Database table and security policies |
| `supabase/posts.sql` | Posts table for the board |
| `supabase/storage.sql` | Image storage bucket for posts |
| `supabase/master.sql` | Master admin policy for viewing all users |
| `supabase/delete_account.sql` | Account deletion function (run after profiles.sql) |
| `start-server.bat` | Start local dev server (GitHub Pages–like `/First/` URL) |
| `serve.py` | Python server used by `start-server.bat` |
