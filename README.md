# First — Digital World Portal

A single-page website with email/password sign-in powered by Supabase.

- **Top (10%)** — Welcome header (shows logged-in user)
- **Left (20%)** — Menu: Welcome, Sign-in, Sign-up, About
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

## Local testing

1. Complete Supabase setup above.
2. Open `index.html` in a browser (or use a local server).
3. Use **Sign-up** to create an account, then **Sign-in**.

## GitHub Pages

The site is deployed from the `main` branch. After updating `js/config.js`, commit and push — GitHub Pages will serve the updated site automatically.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Layout, menu, sign-in/sign-up forms |
| `js/config.js` | Supabase URL and anon key |
| `js/auth.js` | Sign-up, sign-in, sign-out, session handling |
| `supabase/profiles.sql` | Database table and security policies |
| `supabase/delete_account.sql` | Account deletion function (run after profiles.sql) |
