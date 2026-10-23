# Music Video Awards — Church competition website

A mobile-responsive website for **Bastion, Catalyst, Sentinel and Vanguard**. Includes:

- Judges' private login and editable scorecards totaling 100 points
- Configurable expected judge count (not set until the organizer chooses)
- Automatic admin-only judging rankings (average of complete scorecards)
- People's Choice public QR-code link with single-use attendee codes
- Controls to open/close judging and voting
- Admin CSV export of scores, and of newly generated codes
- Presentation-ready winner reveal page

## Demo mode (no backend required)

Requires [Node.js](https://nodejs.org/) 20.19+ or newer.

```bash
npm install
npm run dev
```

Open the printed local address (usually `http://localhost:5173`). With **no `.env` file**, the site runs a demo in your browser. Use **Preview as Admin** or **Preview as Judge** at the top. In Admin, generate test voting codes, download them, and visit `/vote` to cast a test vote. You can edit the judge count later under Event Settings. Local demo state is stored only in the browser using localStorage; it **does not sync across devices** and must **not be used for the actual event**.

## Real, multi-device event setup

1. Create a [Supabase](https://supabase.com/) project. In SQL Editor, run `supabase/schema.sql` exactly once on a new project. This creates the four teams, default scoring criteria, tables, row-level security (RLS), and voting functions.
2. In Supabase **Authentication → Users**, manually create admin and judge email/password accounts; do **not** enable public email sign-up. Keep admin passwords secret. You can create any number of judges whenever decided.
3. In Supabase SQL Editor, assign roles by editing and running the lines below for each Auth user (replace placeholder emails/names with existing accounts):

```sql
insert into public.profiles(id,display_name,role,active)
select id,'Event Administrator','admin',true
from auth.users where email='admin@example.com';

insert into public.profiles(id,display_name,role,active)
select id,'Judge One','judge',true
from auth.users where email='judge1@example.com';
```

4. Copy `.env.example` to `.env`, then set your **Project URL** and **publishable / anon key** from the Supabase Project API settings:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

**Never use the service_role/secret key in frontend env variables.** These frontend keys are public and work safely only when the Supabase Row Level Security rules are applied.

5. `npm run dev` and test an admin login, a judge login, and a trial People's Choice vote. Only the public ballot should be usable without logging in.
6. Deploy the Git repository to [Vercel](https://vercel.com/) as a **Vite** project. In Vercel, configure the same two `VITE_` environment variables, then redeploy. `vercel.json` provides SPA route rewrites for `/admin`, `/judge`, `/vote` etc.
7. Sign in as admin at `https://YOUR-SITE.vercel.app/login`. The **Audience QR Code** in `/admin` now points to the site's public `/vote` URL. Print or display that QR on the church projector. If you later change the site's domain, regenerate the QR from the new site URL.
8. In Admin, generate enough **one-time voter codes** (one per attendee). **Immediately download the CSV.** For safety, in live mode the server stores only code hashes and cannot export plaintext codes again. Give each attendee exactly one randomly assigned code during entry or registration. Codes prevent reuse, but the event staff must control distribution to avoid issuing more than one per person.
9. When everyone is ready, close voting and judging with the Admin toggles. Check that **every intended judge submitted all four scorecards**. Enable Results Announcement and open `/reveal` on the projector (F11 for fullscreen). Resolve ties manually according to your rules.

## Competition rubric (editable before any scoring)

| Category | Max |
|---|---:|
| Message & Biblical Relevance | 25 |
| Creativity & Originality | 25 |
| Cinematography & Editing | 20 |
| Musical Performance | 20 |
| Overall Impact | 10 |
| **TOTAL** | **100** |

## Important security/event notes

- The Admin and Judges' interfaces are not secured solely by URL secrecy. Live mode uses Supabase Auth + RLS. Team and rubric are public; other judges' scorecards and vote tallies are not.
- Reusing a voting code is denied by the server. The vote is recorded and the code is marked used in one database transaction. The server never trusts the page's displayed `voting_open`/`scoring_open` value for enforcement.
- The website is not hosted by this ZIP file; a real QR code is usable by attendees **only after deployment** with working database credentials.
- For an event, run rehearsal voting and scoring tests, then start with a clean database or fresh Supabase project before official voting (do not mix test and official votes).
- Configure event rules before competition starts: judge count, criteria, whether late judges may be added, and a tie-breaker. Ranks are provisional if any judge has not completed all four groups.
- Supabase and Vercel offer free tiers, but limits/terms can change. Review current quotas for your expected audience before event day.

## How to modify

- `src/data.js`: initial demo teams/criteria/settings.
- `src/App.jsx`: frontend pages and workflows.
- `src/styles.css`: colors and responsive layout.
- `src/CompetitionContext.jsx`: browser demo and Supabase integration.
- `supabase/schema.sql`: production database tables, access controls and RPCs.

## Build check

```bash
npm run build
npm run preview
```
