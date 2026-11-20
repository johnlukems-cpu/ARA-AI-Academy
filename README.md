# ARA AI Academy

Tweetalig (Nederlands/Engels) online leerplatform van **ARA AI Solutions** voor Suriname: betaalde AI-cursussen met handmatige betaalcontrole, 90 dagen toegang, lessen, opdrachten, quizzen, eindexamens en PDF-certificaten met QR-verificatie.

**Stack:** Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 · Supabase (Auth, Postgres met Row Level Security, Storage) · Resend (e-mail) · Vercel (hosting en cron).

---

## Inhoud

1. [Functionaliteit](#functionaliteit)
2. [Lokaal installeren](#lokaal-installeren)
3. [Omgevingsvariabelen](#omgevingsvariabelen)
4. [Supabase instellen](#supabase-instellen)
5. [Beheerder instellen](#beheerder-instellen)
6. [Deployen op Vercel](#deployen-op-vercel)
7. [Cursussen beheren](#cursussen-beheren)
8. [Testen](#testen)
9. [Architectuur](#architectuur)
10. [Beveiliging](#beveiliging)

---

## Functionaliteit

| Onderdeel | Wat het doet |
|---|---|
| Publieke site (`/nl`, `/en`) | Home, over ons, cursusoverzicht en -detail, werkwijze, prijzen, FAQ, contact, voorwaarden, privacy, certificaatverificatie |
| Accounts | Registratie met e-mailbevestiging, inloggen, wachtwoord vergeten. **Een account geeft géén toegang tot cursussen.** |
| Inschrijven en betalen | Student vraagt inschrijving aan, ziet betaalinstructies (SRD), uploadt betaalbewijs/referentie. Betaalmethoden zijn instelbaar en modulair (later uit te breiden met een gateway). |
| Betaalcontrole | Beheerder keurt goed/af (met reden) of markeert als terugbetaald. Goedkeuren activeert direct toegang. |
| Toegang | Standaard 90 dagen (per cursus instelbaar). Resterende dagen zichtbaar, herinneringen op 30/14/7/1 dag, automatisch verlopen, verlengen door beheerder. Voortgang en certificaten blijven bewaard na verlopen. |
| Leren | Modules → lessen (video, tekst, PDF, opdracht, quiz, externe link). Een les kan pas voltooid worden nadat de inhoud is geopend (PDF: het bestand). Voortgang per cursus. |
| Opdrachten | Tekst, link en/of bestand. Beoordeling door beheerder met score en feedback (of automatisch goedgekeurd). |
| Quizzen en eindexamen | Eén antwoord, waar/onwaar, meerdere antwoorden, kort antwoord. Slagingsgrens (standaard 70%), tijdslimiet met automatische inlevering, maximaal aantal pogingen, wachttijd voor herkansing, willekeurige volgorde, optioneel antwoorden tonen. Nakijken gebeurt op de server; antwoordsleutels zijn nooit zichtbaar voor studenten. |
| Certificaten | Automatisch uitgegeven zodra aan de vereisten is voldaan (instelbaar: verplichte lessen, opdrachten, eindexamen). PDF met logo, naam, cursus, datum, uniek ID, handtekening en QR-code naar `/verify/<ID>`. Intrekken en opnieuw uitgeven. Bevat expliciet géén accreditatieclaim. |
| Beheer (`/nl/admin`) | Dashboard met KPI's, studenten (zoeken, profiel, handmatig inschrijven, verlengen, intrekken, schorsen, rol, voortgang resetten, wachtwoordherstel), betalingen, inschrijvingen, cursusbouwer, opdrachten beoordelen, certificaten, contactberichten, rapporten (CSV/PDF), instellingen (algemeen, betaalmethoden, e-mailsjablonen), auditlog. |
| E-mail | Tweetalige sjablonen via Resend in de taal van de student, aanpasbaar in beheer. Zonder API-sleutel worden e-mails gelogd als "skipped". |

## Lokaal installeren

Vereist: Node.js 20.12 of nieuwer, npm, een Supabase-project (gratis plan volstaat om te starten).

```bash
git clone https://github.com/johnlukems-cpu/ARA-AI-Academy.git
cd ARA-AI-Academy
npm install
cp .env.example .env.local   # vul de waarden in (zie hieronder)
npm run dev                  # http://localhost:3000
```

Handige scripts:

| Script | Doel |
|---|---|
| `npm run dev` | Ontwikkelserver |
| `npm run build` / `npm start` | Productiebuild / starten |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript-controle |
| `npm test` | Unit-tests (Vitest) |
| `npm run test:db` | Database-workflowtests A–J op een lokale PostgreSQL (zie [Testen](#testen)) |
| `npm run admin:promote -- <email>` | Bestaand account beheerder maken |
| `npm run seed:generate` | `supabase/seed.sql` opnieuw genereren uit `scripts/catalog.mjs` |

## Omgevingsvariabelen

| Variabele | Waar te vinden | Zichtbaar in browser? |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Je domein, bijv. `https://academy.arasolutions.sr` (zonder `/` aan het eind) | ja |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | ja |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon`/publishable key | ja (beschermd door RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` key | **nee – alleen server** |
| `RESEND_API_KEY` | resend.com → API Keys | nee |
| `EMAIL_FROM` | Afzender op een in Resend geverifieerd domein, bijv. `ARA AI Academy <academy@jouwdomein.sr>` | nee |
| `ADMIN_NOTIFICATION_EMAIL` | Optioneel: adres voor beheermeldingen (kan ook in Beheer → Instellingen) | nee |
| `CRON_SECRET` | Zelf genereren: `openssl rand -hex 32` (minimaal 16 tekens) | nee |

Zet nooit de service role key of andere geheimen in code of in variabelen die met `NEXT_PUBLIC_` beginnen.

## Supabase instellen

1. **Project aanmaken** op supabase.com (regio bij voorkeur `us-east-1` of `sa-east-1` voor Suriname).
2. **Database:** voer de migraties uit, in deze volgorde, via de SQL Editor of de Supabase CLI:
   ```
   supabase/migrations/20261120000001_schema.sql     # tabellen, enums, indexen
   supabase/migrations/20261120000002_functions.sql  # bedrijfslogica (RPC's), triggers
   supabase/migrations/20261120000003_rls.sql        # Row Level Security en kolomrechten
   supabase/migrations/20261120000004_storage.sql    # storage buckets en policies
   ```
   Met de CLI: `supabase link --project-ref <ref>` en daarna `supabase db push`.
3. **Startgegevens:** voer `supabase/seed.sql` uit. Dit maakt de instellingen, drie betaalmethoden (bankoverschrijving, contant, mobiel betalen – uitgeschakeld) en 8 cursussen als **concept** met tweetalig voorlopig curriculum. Het script is veilig om opnieuw te draaien.
4. **Authentication → URL Configuration:**
   - Site URL: je `NEXT_PUBLIC_SITE_URL`
   - Redirect URLs: `https://<jouw-domein>/auth/confirm` (en `http://localhost:3000/auth/confirm` voor ontwikkeling)
5. **Authentication → Providers → Email:** "Confirm email" aan. Minimale wachtwoordlengte 8.
6. **Authentication → Email Templates:** plak de tweetalige sjablonen uit `supabase/templates/`:
   - *Confirm signup* → `confirm.html` (onderwerp: `Bevestig je e-mailadres / Confirm your email`)
   - *Reset password* → `recovery.html` (onderwerp: `Wachtwoord herstellen / Reset your password`)
   - *Change email address* → `email_change.html`
7. **Authentication → SMTP Settings (aanbevolen):** gebruik Resend als SMTP (`smtp.resend.com`, poort 465, gebruiker `resend`, wachtwoord = je Resend API-sleutel) zodat ook de bevestigingsmails van je eigen domein komen. De ingebouwde Supabase-mailer is alleen bedoeld voor testen en heeft een lage limiet.
8. **Storage:** de buckets worden door migratie 4 aangemaakt (`public-assets`, `course-resources`, `payment-proofs`, `assignment-files`). Alleen `public-assets` is openbaar; de rest werkt via kortlevende ondertekende links.

## Beheerder instellen

Er zijn bewust geen vaste beheerderswachtwoorden.

1. Registreer op de website met het e-mailadres van de beheerder en bevestig het e-mailadres.
2. Maak het account beheerder (op een vertrouwde computer met `.env.local`):
   ```bash
   npm run admin:promote -- admin@jouwdomein.sr
   ```
   Alternatief in de Supabase SQL Editor: `update public.profiles set role = 'admin' where email = 'admin@jouwdomein.sr';`
3. Log in en ga naar `/nl/admin`. Extra beheerders maak je daarna via Beheer → Studenten → "Beheerder maken".
4. Vul in Beheer → Instellingen de contactgegevens, het e-mailadres voor beheermeldingen, de naam/functie van de ondertekenaar en (optioneel) een handtekening (PNG) in. Controleer de betaalinstructies (bankrekeningnummer!) onder Betaalmethoden.

## Deployen op Vercel

1. Importeer de GitHub-repository in Vercel (framework: Next.js, standaardinstellingen).
2. Voeg alle omgevingsvariabelen toe (Production en Preview). Zet `NEXT_PUBLIC_SITE_URL` op het productiedomein.
3. Deploy. Koppel daarna je eigen domein en werk de Site URL/Redirect URLs in Supabase bij.
4. **Cron:** `vercel.json` plant `/api/cron/daily` dagelijks om 11:00 UTC (08:00 Suriname). Vercel stuurt automatisch `Authorization: Bearer $CRON_SECRET`. Deze taak laat verlopen inschrijvingen verlopen, verstuurt herinneringen (30/14/7/1 dagen, instelbaar) en ruimt oude rate-limit-gegevens op. Handmatig testen:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://<domein>/api/cron/daily
   ```
5. **Resend:** verifieer je domein (SPF/DKIM) in Resend voordat je `EMAIL_FROM` instelt.

## Cursussen beheren

1. Beheer → Cursussen → kies een cursus (de 8 voorbeeldcursussen staan als concept klaar) of "Nieuwe cursus".
2. Vul titel, beschrijving, leerdoelen enz. in **beide talen** in, stel prijs, valuta, toegangsduur en de certificaatvereisten in.
3. Curriculum: voeg modules en lessen toe, wijzig de volgorde met de pijltjes. Per les: type, inhoud (Markdown) in NL en EN, video (YouTube/Vimeo/Bunny-ID of MP4-URL), downloads, opdrachtinstellingen of quizvragen.
4. Een les publiceer je via Status → Gepubliceerd. Dit lukt alleen als de les compleet is (beide titels, inhoud/video/PDF/quiz).
5. Eindexamen: "Eindexamen aanmaken", vragen toevoegen, instellingen (slagingsgrens, tijd, pogingen, herkansingswachttijd) en publiceren.
6. Cursus publiceren: alleen mogelijk met beide talen ingevuld, een prijs, minimaal één gepubliceerde les en (indien vereist) een gepubliceerd eindexamen met vragen. Lege cursussen blijven dus concept.

> De voorbeeldcursussen bevatten placeholder-lesinhoud. Vervang die door echte inhoud voordat je lessen publiceert. Alleen *AI Fundamentals* bevat al 6 echte examenvragen.

## Testen

```bash
npm test          # 29 unit-tests: nakijken, herkansingsregels, e-mail-escaping, i18n-pariteit, certificaat-PDF, CSV, video-embeds, herinneringen
npm run lint
npm run typecheck
npm run build
```

**Database-workflowtests (A–J)** draaien tegen een echte PostgreSQL 15/16 met een minimale Supabase-stub (`supabase/tests/supabase_stub.sql`). Ze maken de database `ara_test` opnieuw aan, voeren alle migraties en de seed uit en doorlopen registratie, inschrijving, betaling, goedkeuring, leren, examen, certificering, verlopen, beheer en tweetaligheid via dezelfde RPC's en RLS-regels als de app:

```bash
PGHOST=localhost PGUSER=postgres PGPASSWORD=... npm run test:db
```

De handmatige testchecklist voor een staging-omgeving staat in [`docs/TESTCHECKLIST.md`](docs/TESTCHECKLIST.md).

## Architectuur

```
src/
  app/
    [locale]/(public)/…      publieke pagina's (nl/en)
    [locale]/(auth)/…        inloggen, registreren, wachtwoord
    [locale]/dashboard/…     studentenportaal
    [locale]/admin/…         beheeromgeving
    actions/                 server actions (formulieren)
    api/                     bestanden (ondertekende links), certificaat-PDF, rapporten, cron
    auth/                    e-mailbevestiging, uitloggen
  components/                UI, formulieren, portaal- en beheercomponenten
  i18n/                      nl/en woordenboeken (gelijke sleutels afgedwongen door tests)
  lib/                       auth, supabase-clients, quiz, certificaat, e-mail, rapporten, cron
  proxy.ts                   taalroutering, sessieverversing, routebescherming
supabase/
  migrations/                schema, functies, RLS, storage
  seed.sql                   instellingen, betaalmethoden, 8 conceptcursussen
  templates/                 tweetalige auth-e-mails
  tests/supabase_stub.sql    stub voor lokale databasetests
scripts/                     seed-generator, catalogus, beheerder-script
tests/                       unit-tests en database-workflowtests
```

**Belangrijkste tabellen:** `profiles`, `academy_settings`, `payment_methods`, `courses`, `course_translations`, `course_modules`, `lessons`, `lesson_contents`, `lesson_resources`, `assignments`, `assignment_submissions`, `enrollments`, `payments`, `payment_evidence`, `lesson_progress`, `quizzes`, `quiz_questions`, `quiz_options`, `quiz_attempts`, `certificates`, `notifications`, `email_templates`, `email_log`, `enrollment_reminders`, `audit_logs`, `contact_messages`, `rate_limits`.

Alle statuswijzigingen in de workflow (inschrijven, betalen, goedkeuren, voortgang, certificaten) lopen via `SECURITY DEFINER`-functies die zelf autoriseren; studenten hebben geen directe schrijfrechten op die tabellen.

## Beveiliging

- Row Level Security op alle tabellen; studenten zien alleen hun eigen profiel, betalingen, voortgang, pogingen en certificaten.
- Kolomrechten: studenten kunnen hun rol/status niet wijzigen; betalingen alleen via RPC's.
- Antwoordsleutels van quizzen zijn alleen voor beheerders leesbaar; nakijken op de server; te late inzendingen tellen niet.
- Uploads via eenmalige ondertekende upload-URL's met type- en groottecontrole; downloads via kortlevende ondertekende links na toegangscontrole.
- Rate limiting op registratie, inloggen, contact, betalingen en opdrachten.
- Auditlog voor alle beheeracties en belangrijke workflowstappen.
- Beveiligingsheaders (HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy).
- E-mailsjablonen escapen alle variabelen; CSV-export neutraliseert formules.

## Licentie en inhoud

© ARA AI Solutions. De juridische teksten in `src/content/legal.ts` zijn een startpunt en moeten door een jurist worden gecontroleerd. Certificaten bevestigen de afronding van een training en zijn geen overheids- of internationaal geaccrediteerde diploma's.
