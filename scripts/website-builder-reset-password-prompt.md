# Website builder agent: IronPath password reset page

Paste this entire file into the website builder agent. Implement exactly this page. Do not invent a different auth flow, a form that emails a new password, or a custom `passwords` table.

## Goal

Create a live public page at:

`https://tryironpath.com/reset-password`

This is where IronPath forgot-password emails send the user. The email link looks like:

`https://tryironpath.com/reset-password?token_hash=<TOKEN>&type=recovery`

The page must:

1. Keep the query string (`token_hash`, `type`). Never strip, rewrite, or drop it.
2. Verify the token with Supabase Auth (`verifyOtp`).
3. Let the user set a new password (`updateUser`).
4. Write that password into the **same** IronPath Auth database the iOS app uses (`auth.users` on project `wmraczqltegkqbststik`). There is no custom password table.

## Hosting rules

- Canonical URL: `https://tryironpath.com/reset-password` (no trailing slash).
- Also serve `https://www.tryironpath.com/reset-password`, **or** 301 www → apex **while preserving the full query string**.
- This must be a real route, not a client-only hash route, not a homepage overlay, and not a Framer/Webflow modal that drops `?token_hash=`.
- Do not enable a website builder feature that wraps or tracks outbound/inbound links in a way that consumes the token.
- After publish, `https://tryironpath.com/reset-password` must return HTTP 200 with this UI (a missing `token_hash` shows the invalid-link state, which is correct).

## Supabase client (public keys only)

```js
const SUPABASE_URL = 'https://wmraczqltegkqbststik.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_irqx8BD5vv0OnLCLhDB1dA_s2euvgyB';
```

- Use `@supabase/supabase-js` from a CDN (ESM).
- Never use a `service_role` / secret key.
- Do not log `token_hash`, passwords, or session tokens.
- Password minimum: **8 characters** (same as the IronPath app).

## Auth sequence (required)

On load:

1. Read `token_hash` and `type` from `window.location.search`.
2. If either is missing, show “This reset link is invalid or has expired.”
3. Call:

```js
await supabase.auth.verifyOtp({
  token_hash,
  type: 'recovery',
});
```

4. On success, show new password + confirm password fields.
5. On submit:

```js
await supabase.auth.updateUser({ password });
await supabase.auth.signOut();
```

6. Show success: tell the user to open the IronPath app and sign in with the new password.
7. On verify/update failure, show a safe error. Do not dump raw API payloads.

Do **not** use `exchangeCodeForSession`, PKCE `code`, or `{{ .ConfirmationURL }}`. Those cannot complete on this website because the reset was requested from the iOS app.

## Design

Match IronPath:

- Background `#09090b`
- Card `#18181b` with border `#27272a`
- Lime CTA `#a3e635` and text on CTA `#09090b`
- Body text `#a1a1aa`, muted `#71717a`, headings `#ffffff`
- Logo: `https://www.tryironpath.com/logos/ironpath-logo-static.svg`
- Wordmark: IRONPATH, letter-spacing, lime
- Support: `support@tryironpath.com`
- Centered card, max-width ~420px, mobile-first

## Implement this page exactly

Use this HTML as the page body (or a custom-code embed that is the whole `/reset-password` document). You may split CSS, but do not change the auth logic.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Reset password · IronPath</title>
    <style>
      :root {
        --bg: #09090b;
        --card: #18181b;
        --border: #27272a;
        --lime: #a3e635;
        --text: #ffffff;
        --muted: #a1a1aa;
        --faint: #71717a;
        --error: #fca5a5;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background: var(--bg);
        color: var(--text);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 32px 16px;
      }
      .wrap { width: 100%; max-width: 420px; text-align: center; }
      .logo { width: 80px; height: 80px; display: block; margin: 0 auto 10px; }
      .wordmark {
        margin: 0 0 24px;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.22em;
        color: var(--lime);
      }
      .card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 32px 28px;
        text-align: left;
      }
      h1 {
        margin: 0 0 12px;
        font-size: 22px;
        line-height: 1.3;
        font-weight: 600;
      }
      p { margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: var(--muted); }
      .hint { font-size: 13px; color: var(--faint); }
      label {
        display: block;
        margin: 0 0 6px;
        font-size: 14px;
        color: var(--muted);
      }
      input {
        width: 100%;
        margin: 0 0 14px;
        padding: 12px;
        border-radius: 8px;
        border: 1px solid var(--border);
        background: var(--bg);
        color: var(--text);
        font-size: 16px;
      }
      button {
        width: 100%;
        margin-top: 8px;
        padding: 12px 22px;
        border: 0;
        border-radius: 8px;
        background: var(--lime);
        color: var(--bg);
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
      }
      button:disabled { opacity: 0.6; cursor: default; }
      .status { min-height: 1.4em; margin: 0 0 12px; font-size: 14px; color: var(--muted); }
      .status.error { color: var(--error); }
      .support { margin-top: 24px; font-size: 12px; color: var(--faint); }
      .support a { color: var(--muted); text-decoration: none; }
      .hidden { display: none; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <img class="logo" src="https://www.tryironpath.com/logos/ironpath-logo-static.svg" width="80" height="80" alt="IronPath" />
      <p class="wordmark">IRONPATH</p>
      <div class="card">
        <h1>Reset your password</h1>
        <p id="subtitle">Choose a new password for your IronPath account.</p>
        <p id="status" class="status" role="status"></p>
        <form id="form" class="hidden" autocomplete="on">
          <label for="password">New password</label>
          <input id="password" name="password" type="password" minlength="8" required autocomplete="new-password" />
          <label for="confirm">Confirm password</label>
          <input id="confirm" name="confirm" type="password" minlength="8" required autocomplete="new-password" />
          <button id="submit" type="submit">Update password</button>
        </form>
      </div>
      <p class="support">Questions: <a href="mailto:support@tryironpath.com">support@tryironpath.com</a></p>
    </div>
    <script type="module">
      import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

      const SUPABASE_URL = 'https://wmraczqltegkqbststik.supabase.co';
      const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_irqx8BD5vv0OnLCLhDB1dA_s2euvgyB';
      const MIN_PASSWORD_LENGTH = 8;
      const INVALID_LINK = 'This reset link is invalid or has expired. Request a new one from the IronPath app.';

      const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      const form = document.getElementById('form');
      const statusEl = document.getElementById('status');
      const subtitleEl = document.getElementById('subtitle');
      const submitBtn = document.getElementById('submit');

      function setStatus(message, isError) {
        statusEl.textContent = message;
        statusEl.classList.toggle('error', Boolean(isError));
      }

      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get('token_hash');
      const type = params.get('type');

      async function verifyLink() {
        if (!tokenHash || type !== 'recovery') {
          setStatus(INVALID_LINK, true);
          return;
        }

        setStatus('Verifying reset link…', false);
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'recovery',
        });

        if (error) {
          setStatus(INVALID_LINK, true);
          return;
        }

        setStatus('', false);
        form.classList.remove('hidden');
      }

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const password = document.getElementById('password').value;
        const confirm = document.getElementById('confirm').value;

        if (password.length < MIN_PASSWORD_LENGTH) {
          setStatus('Password must be at least 8 characters.', true);
          return;
        }
        if (password !== confirm) {
          setStatus('Passwords do not match.', true);
          return;
        }

        submitBtn.disabled = true;
        setStatus('Updating password…', false);

        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          submitBtn.disabled = false;
          setStatus('Unable to update password. Try a stronger password or request a new reset link.', true);
          return;
        }

        await supabase.auth.signOut();
        form.classList.add('hidden');
        subtitleEl.textContent = 'Your password was updated.';
        setStatus('Open the IronPath app and sign in with your new password.', false);
      });

      verifyLink();
    </script>
  </body>
</html>
```

## Done when

- Visiting `https://tryironpath.com/reset-password` without params shows the invalid-link message (not the marketing homepage).
- Visiting with `?token_hash=test&type=recovery` still shows this page (verify will fail; that is OK).
- Query params survive a www ↔ apex redirect.
- No service role key is present in the published page source.
