# Disabling Chrome password suggestions (project guidance)

This doc captures the practical approach we use to minimize Chrome/Edge's black credential suggestions on the Login and Signup pages. A complete programmatic disablement of browser password managers is not possible from a web page (by design), but these techniques reliably reduce the UI intrusion in our flows.

## Summary of our approach

We prevent Chrome from treating our visible password inputs as true password fields while keeping a native-looking mask:

- Use `type="text"` with CSS masking via `-webkit-text-security: disc;` to visually hide characters.
- Set `autocomplete="off"` on visible email and password inputs.
- Keep inputs `readonly` until focus to discourage autofill injection.
- Add hidden decoy fields before the visible inputs to absorb browser heuristics.
- Hint third‑party password managers to ignore these fields with vendor attributes.

This combination removes the black account/password suggestions for most users while keeping forms usable.

## Where it is implemented

- `frontend/src/components/Login.js`
- `frontend/src/components/Signup.js`
- `frontend/src/components/UserManagement.js` (Add New User modal)

The practice creation wizard already uses standards tokens for admin user creation (new password) and normally doesn’t trigger the account chooser.

## Code pattern (JSX)

Email (visible):

```jsx
<input
  type="text"
  inputMode="email"
  autoComplete="off"
  autoCorrect="off"
  autoCapitalize="off"
  spellCheck={false}
  aria-autocomplete="none"
  data-lpignore="true"   // LastPass
  data-1p-ignore           // 1Password
  data-bw-ignore           // Bitwarden
  readOnly
  onFocus={e => e.currentTarget.removeAttribute('readonly')}
  // ...styles
/>
```

Password (visible, masked text):

```jsx
<input
  type="text"
  autoComplete="off"
  autoCorrect="off"
  autoCapitalize="off"
  spellCheck={false}
  style={{ WebkitTextSecurity: 'disc' /* plus other styles */ }}
  aria-autocomplete="none"
  data-lpignore="true"
  data-1p-ignore
  data-bw-ignore
  readOnly
  onFocus={e => e.currentTarget.removeAttribute('readonly')}
/>
```

Decoy field (single, optimized to reduce DOM warnings):

```jsx
<input type="text" name="_decoy" autoComplete="username" aria-hidden="true" tabIndex={-1} style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }} />
```

Notes:
- Keep labels (`<label htmlFor=...>`) for accessibility.
- We deliberately set `autocomplete="off"` on the visible fields; browsers may ignore this for real password inputs, which is why we avoid `type="password"`.
- Single decoy field reduces DOM warnings about "multiple forms" while maintaining autofill suppression effectiveness.

## Trade‑offs & considerations

- This pattern intentionally sidelines built‑in password managers. Users who rely on them won’t get automatic suggestions in these views.
- Masking with `-webkit-text-security` is visual only; it doesn’t change how values are handled. Continue to use HTTPS, secure cookies, CSRF protections, and server‑side validation.
- Cross‑browser: masking works in Chromium and WebKit; on some non‑WebKit engines the property may be ignored (rare for our targets). If needed, we can add a fallback (e.g., toggling to `type="password"` while keeping other mitigations).

## Testing checklist

- Open Login and Signup in Chrome/Edge (desktop and mobile) and verify no black account chooser appears when focusing email/password.
- Ensure tabbing, labels, and RTL text direction work.
- Confirm that removing `readonly` on focus allows typing as expected.
- Verify that form submission still sends the expected values.

## Alternatives (if we want to re‑enable managers later)

1. Standards tokens (preferred semantics):
   - Login: `autocomplete="username"` and `autocomplete="current-password"`.
   - Signup/reset: `autocomplete="new-password"`.
   This enables password manager UX and is recommended by MDN/web.dev.

2. Two‑step sign‑in:
   Split email and password onto separate steps/pages. This often confines account suggestions to step 1 and avoids UI overlap.

3. Enterprise policy:
   In managed environments, administrators can disable password managers at the browser policy level.

## Maintenance

- When adding new auth forms, copy this pattern or revisit the decision if we want to adopt the standards approach + two‑step flow.
- Keep vendor ignore attributes; managers evolve and may add new flags.
- If we later switch back to standard tokens, remove the masked‑text workaround and restore `type="password"` with `current-password/new-password` tokens.
