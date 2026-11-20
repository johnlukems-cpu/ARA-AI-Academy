# Testchecklist ARA AI Academy (staging)

Handmatige controle op een staging-omgeving met echte Supabase, Resend en Vercel.
Werk de workflows in volgorde af. Gebruik twee testaccounts: **student** (gewoon e-mailadres) en **admin** (gepromoveerd met `npm run admin:promote -- <email>`).

Vink af met `[x]`. Noteer afwijkingen met datum en schermafbeelding.

## 0. Voorbereiding
- [ ] Alle migraties en `supabase/seed.sql` zijn toegepast op het staging-project
- [ ] Omgevingsvariabelen staan in Vercel (zie README)
- [ ] Auth-e-mailtemplates uit `supabase/templates/` staan in Supabase → Authentication → Email Templates
- [ ] Site URL en redirect URL (`/auth/confirm`) staan goed in Supabase
- [ ] Resend-domein is geverifieerd, `EMAIL_FROM` gebruikt dat domein
- [ ] Bankgegevens en betaalinstructies staan in Admin → Instellingen → Betalingen
- [ ] Ten minste één cursus is gepubliceerd met prijs, lessen, quiz en eindexamen

## A. Registratie
- [ ] Registreren met naam, e-mail en wachtwoord lukt (NL en EN)
- [ ] Bevestigingsmail komt aan in de gekozen taal; link werkt
- [ ] Inloggen vóór bevestiging wordt geweigerd met duidelijke melding
- [ ] Na inloggen: dashboard toont **geen** cursustoegang
- [ ] Wachtwoord vergeten → herstelmail → nieuw wachtwoord werkt
- [ ] Na 5+ mislukte pogingen volgt een rate-limit-melding

## B. Inschrijving en betaling
- [ ] Cursuspagina toont prijs in SRD en de knop Inschrijven
- [ ] Student kiest betaalmethode en ziet de instructies
- [ ] Betaalbewijs uploaden (PDF/JPG/PNG, max. 10 MB) lukt; ander bestandstype wordt geweigerd
- [ ] Status is "In afwachting"; lessen zijn nog op slot
- [ ] Admin ontvangt een notificatiemail over de nieuwe betaling

## C. Goedkeuring door admin
- [ ] Admin → Betalingen toont de betaling met bewijs (bewijs opent alleen voor admin)
- [ ] Afwijzen met reden: student krijgt mail en melding, geen toegang
- [ ] Opnieuw indienen en goedkeuren: student krijgt mail "toegang geactiveerd"
- [ ] Auditlog bevat de goedkeuring

## D. 90 dagen toegang
- [ ] Inschrijving toont vervaldatum = goedkeuring + 90 dagen (of ingestelde standaard)
- [ ] Dashboard toont resterende dagen
- [ ] Admin verlengt met 30 dagen; nieuwe datum klopt en student krijgt melding
- [ ] Cron-endpoint handmatig: `curl -H "Authorization: Bearer $CRON_SECRET" https://<domein>/api/cron/daily` geeft 200
- [ ] Zonder of met verkeerd token geeft het endpoint 401

## E. Leren
- [ ] Lessen van een niet-ingeschreven cursus zijn niet bereikbaar (ook niet via directe URL)
- [ ] Video (YouTube/Vimeo/Bunny) laadt; tekstles toont opgemaakte inhoud
- [ ] PDF/bijlage opent via beveiligde link
- [ ] Les afronden kan pas nadat de inhoud geopend is
- [ ] Voortgangsbalk werkt bij; vorige/volgende navigatie werkt
- [ ] Opdracht inleveren met bestand; admin beoordeelt in Admin → Inzendingen; student ziet feedback

## F. Examen
- [ ] Eindexamen is op slot tot alle verplichte lessen af zijn
- [ ] Timer loopt; bij tijd op wordt automatisch ingeleverd
- [ ] Score < 70% = niet geslaagd; herkansing volgens ingestelde regels en wachttijd
- [ ] Maximaal aantal pogingen wordt afgedwongen
- [ ] Juiste antwoorden zijn niet zichtbaar in de broncode/netwerk tijdens het examen
- [ ] Geslaagd: resultaatpagina toont score en "geslaagd"

## G. Certificaat
- [ ] Na slagen verschijnt het certificaat onder Mijn certificaten en komt er een mail
- [ ] PDF downloadt (NL en EN) met logo, naam, cursus, datum, ID en QR-code
- [ ] QR-code opent `/<taal>/verify/<code>` en toont "geldig"
- [ ] Geen claim van overheids- of internationale accreditatie in PDF of pagina
- [ ] Admin trekt certificaat in → verificatiepagina toont "ingetrokken"; student kan PDF niet meer downloaden
- [ ] Opnieuw uitgeven maakt een nieuwe code

## H. Verlopen
- [ ] Zet in de database een `expires_at` in het verleden en draai de cron → status "verlopen"
- [ ] Student krijgt mail "toegang verlopen"; lessen zijn op slot; certificaten blijven geldig
- [ ] Herinneringen op 30/14/7/1 dagen worden één keer per inschrijving verstuurd (cron twee keer draaien → geen dubbele mail)

## I. Administratie
- [ ] Dashboard-KPI's kloppen met de data
- [ ] Studenten zoeken, profiel bekijken, handmatig inschrijven, voortgang resetten
- [ ] Student schorsen → kan niet meer inloggen/leren; heractiveren werkt
- [ ] Cursusbouwer: cursus, module, les, quiz en vragen aanmaken, volgorde wijzigen
- [ ] Publiceren van een cursus zonder lessen/examen wordt geblokkeerd
- [ ] Rapporten downloaden als CSV en PDF; CSV opent correct in Excel (accenten)
- [ ] Instellingen: naam, logo, handtekening, betaalmethodes en e-mailtemplates wijzigen
- [ ] Contactberichten verschijnen in Admin → Berichten
- [ ] Een student kan geen admin-pagina's openen (krijgt 404/doorverwijzing)

## J. Tweetalig
- [ ] Taalwissel NL ↔ EN op elke pagina behoudt de huidige pagina
- [ ] Cursusinhoud valt terug op de andere taal met een melding als vertaling ontbreekt
- [ ] E-mails volgen de voorkeurstaal van de student
- [ ] Datums en bedragen staan in het juiste formaat (SRD)

## Beveiliging (steekproef)
- [ ] Student A kan betaling, inzending, poging of certificaat-PDF van student B niet openen (ID in URL vervangen)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` komt niet voor in de JavaScript-bundel (zoek in DevTools → Sources)
- [ ] Uploads met verkeerd type of te groot worden geweigerd
- [ ] Security headers aanwezig (X-Frame-Options, HSTS, nosniff, Referrer-Policy) — controleer met securityheaders.com
