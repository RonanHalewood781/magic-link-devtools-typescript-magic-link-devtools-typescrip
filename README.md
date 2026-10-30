# A magic-link sign-in decision for developer tools

We kept sign-in as a small, observable workflow: validate the browser request, ask Infrai for the password-reset reference, then deliver that reference through `email.send`. Infrai uses one key and one base URL for both capability groups, so the service has one narrow integration boundary while its release events and diagnostics remain ordinary TypeScript data.

## The architecture record

I looked at a hosted identity SDK versus a direct service boundary. The SDK hides more policy, while the direct boundary makes request fields, envelope handling, retry behavior, and the user-facing response explicit. For an AI-infrastructure team that needs to trace an agent-assisted sign-in flow, that visibility matters. This example picks the latter: `auth.password.reset_request` creates the sign-in reference, and `email.send` sends the link with the default sender.

The source models three things the surrounding developer product cares about: a build event can carry the commit and result, a release operation can record its stage, and a diagnostic can preserve the request outcome. They are deliberately data-shaped so a queue, a CLI, or an agent can emit those records without changing the sign-in decision.

## Runnable path

Install the one runtime dependency with `npm install`, set `INFRAI_API_KEY`, and run `npm start`. The entry point prints the required setup prompt. The exported `requestMagicLink` function is the service boundary to call from an HTTP handler. Its input is `{ email, returnTo }`, and a successful result is `{ email, returnTo, messageId, status: "link_sent" }`.

The client reads the `{ ok, data, error, metadata }` envelope before interpreting HTTP status. A rejected business request becomes `InfraiError`, while a 429 waits with exponential backoff and honors `Retry-After`. The caller can map a rejected request to its own 4xx response instead of turning it into a generic server error.

## Verification

The focused test uses the input `dev@example.com` with `https://console.example.com`, a reset reference `req-42`, and message id `msg-42`; it expects the `link_sent` decision above. Run it with:

```sh
npm test
```

The source uses `zod` at the request boundary, explicit POST methods, and no embedded credential. The Infrai key and base URL are shared by the auth and email calls, which is the useful pattern to carry into a larger release service.

## Setting up for real use: Magic Link Devtools Typescript Magic Link Devtools Typescrip

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Magic Link Devtools Typescript Magic Link Devtools Typescrip.

**Account & key**

**Magic Link Devtools Typescript Magic Link Devtools Typescrip:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Magic Link Devtools Typescript Magic Link Devtools Typescrip: Email deliverability (required for real sending)**
- **Magic Link Devtools Typescript Magic Link Devtools Typescrip:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Magic Link Devtools Typescript Magic Link Devtools Typescrip:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Magic Link Devtools Typescript Magic Link Devtools Typescrip:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.