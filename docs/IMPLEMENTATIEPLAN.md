# ARA AI Academy – Technisch implementatieplan

_Versie 1 · 20 november 2026_

## 1. Uitgangssituatie

De repository `johnlukems-cpu/ARA-AI-Academy` was bij de start **leeg** (geen commits, geen code, geen
bestaande branding-bestanden). Er is dus geen bestaande functionaliteit die overschreven kan worden. Het
platform wordt vanaf nul opgebouwd met dezelfde stack als de andere ARA-projecten (Supabase + Vercel).

Er zijn nog geen ARA AI Solutions logobestanden of huisstijlkleuren aangeleverd. Er is daarom een eigen,
originele ARA AI Academy-identiteit gemaakt (logo als SVG, kleurenpalet, typografie) die later eenvoudig
vervangen kan worden via Instellingen → Logo of `public/brand/`.

## 2. Architectuur

| Laag | Keuze | Toelichting |
| --- | --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 | Server Components standaard, Client Components alleen waar interactie nodig is |
| Backend | Next.js Server Actions + Route Handlers | Alle mutaties server-side, met Zod-validatie |
| Database | Supabase Postgres | Migraties in `supabase/migrations`, RLS op elke tabel |
| Auth | Supabase Auth (e-mail + wachtwoord, e-mailverificatie) | Sessies via `@supabase/ssr` cookies, ververst in `src/proxy.ts` |
| Opslag | Supabase Storage | 4 buckets: `public-assets` (publiek), `course-resources`, `payment-proofs`, `assignment-files` (privé, alleen via korte signed URLs) |
| Video | Provider-onafhankelijk (YouTube unlisted, Vimeo, Bunny Stream, directe URL) | Video-ID's worden alleen aan studenten met actieve toegang geleverd |
| E-mail | Resend (REST API), modulair | Zonder API-sleutel worden e-mails gelogd als "overgeslagen" i.p.v. te falen |
| PDF | `pdf-lib` + `qrcode` | Certificaten en PDF-rapporten server-side gegenereerd |
| Hosting | Vercel + Vercel Cron (dagelijks) | Cron verloopt toegang en verstuurt herinneringen |

### Meertaligheid
- URL-structuur `/nl/...` en `/en/...`. De proxy stuurt bezoekers zonder taal-prefix naar hun voorkeurstaal
  (profiel → cookie → browser → NL).
- Alle interface-teksten staan in getypeerde woordenboeken (`src/i18n/dictionaries/nl.ts`, `en.ts`). TypeScript
  dwingt af dat beide talen dezelfde sleutels hebben.
- Inhoud (cursussen, modules, lessen, vragen, e-mails, certificaten) wordt per taal opgeslagen. Een cursus kan
  pas gepubliceerd worden als NL en EN beide zijn ingevuld.
- Voorkeurstaal wordt bij registratie gekozen, opgeslagen in het profiel en gebruikt voor e-mails en certificaten.

### Beveiliging
- Rollen `student` en `admin` in `profiles.role`. Studenten kunnen via kolomrechten hun eigen rol/status niet wijzigen.
- RLS: studenten zien alleen hun eigen profiel, inschrijvingen, betalingen, voortgang, examenpogingen en certificaten.
- Lesinhoud (tekst, video, bestanden) staat in een aparte tabel die alleen leesbaar is bij actieve, niet-verlopen toegang.
- Juiste antwoorden van quizvragen zijn nooit leesbaar voor studenten; nakijken gebeurt server-side.
- Betalingsgoedkeuring, verlenging, intrekking en certificaatuitgifte lopen via `SECURITY DEFINER` databasefuncties
  die zelf controleren of de aanroeper beheerder is, in één transactie, met audit log.
- Service-role sleutel alleen server-side (`import "server-only"`), nooit in de browser.
- Rate limiting (databasegebaseerd, werkt op Vercel zonder extra dienst) voor registratie, contact, betalingen en verificatie.
- Uploads: bestandstype en -grootte gecontroleerd in de server action én afgedwongen door bucket-instellingen.

## 3. Datamodel (hoofdlijnen)

```
auth.users ─1:1─ profiles (rol, status, taal)
courses ─1:n─ course_translations (nl/en)
courses ─1:n─ course_modules ─1:n─ lessons ─1:1─ lesson_contents (beschermd)
                                     lessons ─1:n─ lesson_resources
                                     lessons ─1:1─ assignments ─1:n─ assignment_submissions
courses ─1:n─ quizzes (quiz of eindexamen) ─1:n─ quiz_questions ─1:n─ quiz_options
quizzes ─1:n─ quiz_attempts
profiles ─1:n─ enrollments ─1:n─ payments ─1:n─ payment_evidence
profiles ─1:n─ lesson_progress
enrollments ─1:n─ certificates
payment_methods, academy_settings, email_templates, notifications, email_log,
enrollment_reminders, audit_logs, contact_messages, rate_limits
```

Toegangsduur (`courses.access_days`, standaard 90) en voltooiingseisen (`require_all_mandatory_lessons`,
`require_assignments`, `require_final_exam`, slagingspercentage per examen) zijn aparte instellingen.

Voortgang is gekoppeld aan student + les (niet aan de inschrijving), zodat voortgang en examengeschiedenis
bewaard blijven na verloop of herinschrijving.

## 4. Fasering

| Fase | Inhoud |
| --- | --- |
| 1 Fundament | Project, databaseschema + RLS + functies, auth, branding, tweetalige publieke website (14 pagina's) |
| 2 Studentensysteem | Registratie, verificatie, login, profiel, inschrijving, betaalinstructies, bewijs uploaden, goedkeuring door beheerder |
| 3 Leeromgeving | Cursusbouwer (modules/lessen, volgorde, concept/gepubliceerd), video/tekst/PDF/extern/opdracht/quiz, voortgang |
| 4 Examens & certificaten | Eindexamen (tijdslimiet, pogingen, wachttijd), automatisch nakijken, voltooiingsregels, PDF-certificaat met QR, publieke verificatie |
| 5 Administratie | Dashboard met kerncijfers, studenten-, betalings-, cursus- en certificaatbeheer, rapporten (CSV/PDF), instellingen, e-mailsjablonen, audit log |
| 6 Testen & oplevering | Unit tests (nakijken, voltooiing, i18n), database-/RLS-tests op echte Postgres, build, testchecklist, README |

## 5. Wat de eigenaar moet aanleveren

1. Supabase-project (URL, anon key, service-role key).
2. Resend-account + geverifieerd domein (API-sleutel, afzenderadres).
3. Vercel-project gekoppeld aan deze repository.
4. Domeinnaam (zodra beschikbaar).
5. Betaalgegevens (bankrekeningen, mobiele betaaldiensten) voor de betaalinstructies.
6. ARA AI Solutions logo/huisstijl indien die de standaardidentiteit moet vervangen.
7. Naam en handtekening van de ondertekenaar op certificaten.
