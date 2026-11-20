/**
 * Terms and privacy texts. These are a solid starting point written for ARA AI Academy,
 * but must be reviewed by a legal advisor before launch (see README → Launch checklist).
 */
type Section = { h: string; p: string[] };
type Doc = { title: string; updated: string; intro: string; sections: Section[] };

export const terms: Record<"nl" | "en", Doc> = {
  nl: {
    title: "Algemene voorwaarden",
    updated: "Laatst bijgewerkt: 20 november 2026",
    intro:
      "Deze algemene voorwaarden zijn van toepassing op het gebruik van het online leerplatform ARA AI Academy (het \"Platform\"), aangeboden door ARA AI Solutions, gevestigd in Suriname. Door een account aan te maken ga je akkoord met deze voorwaarden.",
    sections: [
      { h: "1. Account", p: ["Je bent verantwoordelijk voor de juistheid van je gegevens en het geheimhouden van je wachtwoord. Een account is persoonlijk en mag niet worden gedeeld.", "Een account aanmaken geeft geen toegang tot betaalde cursussen. Toegang ontstaat pas na goedkeuring van je betaling."] },
      { h: "2. Inschrijving en betaling", p: ["De prijs van een cursus wordt getoond voordat je je inschrijving indient. Betaling vindt plaats via de op het Platform vermelde betaalmethoden.", "ARA AI Solutions controleert elke betaling. Wij kunnen een betaling afwijzen als het bewijs onvolledig, onleesbaar of onjuist is. Je kunt dan een nieuwe betaling indienen."] },
      { h: "3. Toegangsduur", p: ["Na goedkeuring van je betaling heb je gedurende de vermelde periode (standaard 90 dagen) toegang tot de cursus. Na afloop vervalt de toegang tot het lesmateriaal automatisch, tenzij ARA AI Solutions de toegang verlengt.", "Je voortgang, examenresultaten en uitgereikte certificaten blijven na afloop bewaard."] },
      { h: "4. Gebruik van lesmateriaal", p: ["Al het lesmateriaal is auteursrechtelijk beschermd en uitsluitend bestemd voor persoonlijk gebruik. Het is niet toegestaan materiaal te kopiëren, door te verkopen, openbaar te delen of toegang aan derden te verschaffen."] },
      { h: "5. Examens en certificaten", p: ["Een certificaat wordt uitgereikt wanneer je aan alle voltooiingseisen van de cursus voldoet. Examens moeten zelfstandig en zonder hulp van anderen worden gemaakt.", "Certificaten van ARA AI Academy bevestigen de afronding van een training. Ze zijn niet door de overheid of internationaal geaccrediteerd.", "Bij fraude of misbruik kan ARA AI Solutions een certificaat intrekken."] },
      { h: "6. Annulering en terugbetaling", p: ["Een inschrijvingsaanvraag die nog niet is betaald, kun je zelf annuleren. Verzoeken om terugbetaling na goedkeuring worden per geval beoordeeld; neem hiervoor contact met ons op. Bij terugbetaling kan de toegang tot de cursus worden ingetrokken."] },
      { h: "7. Schorsing", p: ["ARA AI Solutions kan een account schorsen bij schending van deze voorwaarden, misbruik van het Platform of het delen van inloggegevens."] },
      { h: "8. Aansprakelijkheid", p: ["Wij spannen ons in om het Platform betrouwbaar en beschikbaar te houden, maar kunnen geen ononderbroken beschikbaarheid garanderen. De inhoud van de cursussen is bedoeld als educatief materiaal; je blijft zelf verantwoordelijk voor de toepassing ervan. Onze aansprakelijkheid is beperkt tot het bedrag dat je voor de betreffende cursus hebt betaald, voor zover de wet dit toestaat."] },
      { h: "9. Wijzigingen", p: ["Wij kunnen deze voorwaarden wijzigen. Belangrijke wijzigingen maken wij via het Platform of per e-mail bekend."] },
      { h: "10. Toepasselijk recht", p: ["Op deze voorwaarden is het recht van de Republiek Suriname van toepassing. Geschillen worden voorgelegd aan de bevoegde rechter in Paramaribo."] },
    ],
  },
  en: {
    title: "Terms and conditions",
    updated: "Last updated: 20 November 2026",
    intro:
      "These terms and conditions apply to the use of the online learning platform ARA AI Academy (the \"Platform\"), provided by ARA AI Solutions, established in Suriname. By creating an account you agree to these terms.",
    sections: [
      { h: "1. Account", p: ["You are responsible for the accuracy of your details and for keeping your password secret. An account is personal and may not be shared.", "Creating an account does not give access to paid courses. Access is granted only after your payment has been approved."] },
      { h: "2. Enrollment and payment", p: ["The price of a course is shown before you submit your enrollment. Payment is made using the payment methods listed on the Platform.", "ARA AI Solutions verifies every payment. We may reject a payment if the proof is incomplete, illegible or incorrect. You can then submit a new payment."] },
      { h: "3. Access period", p: ["After your payment is approved you have access to the course for the stated period (90 days by default). After that, access to the learning materials ends automatically unless ARA AI Solutions extends it.", "Your progress, exam results and issued certificates are kept after access ends."] },
      { h: "4. Use of learning materials", p: ["All learning materials are protected by copyright and intended for personal use only. You may not copy, resell, publicly share materials or give third parties access."] },
      { h: "5. Exams and certificates", p: ["A certificate is issued when you meet all completion requirements of the course. Exams must be taken independently and without help from others.", "ARA AI Academy certificates confirm completion of a training. They are not government-accredited or internationally accredited.", "In case of fraud or misuse, ARA AI Solutions may revoke a certificate."] },
      { h: "6. Cancellation and refunds", p: ["You can cancel an enrollment request that has not been paid yet. Refund requests after approval are assessed case by case; please contact us. When a refund is granted, access to the course may be revoked."] },
      { h: "7. Suspension", p: ["ARA AI Solutions may suspend an account in case of a breach of these terms, misuse of the Platform or sharing of login details."] },
      { h: "8. Liability", p: ["We do our best to keep the Platform reliable and available, but cannot guarantee uninterrupted availability. Course content is educational material; you remain responsible for how you apply it. Our liability is limited to the amount you paid for the course concerned, to the extent permitted by law."] },
      { h: "9. Changes", p: ["We may change these terms. Important changes will be announced on the Platform or by email."] },
      { h: "10. Governing law", p: ["These terms are governed by the laws of the Republic of Suriname. Disputes will be submitted to the competent court in Paramaribo."] },
    ],
  },
};

export const privacy: Record<"nl" | "en", Doc> = {
  nl: {
    title: "Privacybeleid",
    updated: "Laatst bijgewerkt: 20 november 2026",
    intro:
      "ARA AI Solutions respecteert je privacy. In dit beleid lees je welke persoonsgegevens wij via ARA AI Academy verwerken, waarom, en welke rechten je hebt. Wij handelen in overeenstemming met de toepasselijke Surinaamse wetgeving en internationaal erkende privacybeginselen, zoals dataminimalisatie, doelbinding en beveiliging.",
    sections: [
      { h: "1. Welke gegevens wij verwerken", p: ["Accountgegevens: naam, e-mailadres, telefoonnummer, land, voorkeurstaal en (optioneel) profielfoto.", "Inschrijvings- en betaalgegevens: gekozen cursussen, betaalmethode, bedrag, betaaldatum, transactiereferentie en het betaalbewijs dat je uploadt.", "Leergegevens: voortgang, quiz- en examenresultaten, ingeleverde opdrachten en certificaten.", "Technische gegevens: inlogmomenten en beveiligingslogs (zoals IP-adres bij beheeracties)."] },
      { h: "2. Waarom wij deze gegevens gebruiken", p: ["Om je account te beheren, je betaling te controleren, je toegang tot cursussen te verlenen, je voortgang bij te houden, certificaten uit te reiken en je te informeren over je inschrijving (bijvoorbeeld herinneringen voordat je toegang verloopt).", "Wij gebruiken je gegevens niet voor advertenties van derden en verkopen je gegevens nooit."] },
      { h: "3. Certificaatverificatie", p: ["Op de publieke verificatiepagina zijn uitsluitend je naam, de cursusnaam, de datum van afronding en de status van het certificaat zichtbaar voor wie het certificaat-ID invoert. Andere gegevens worden niet getoond."] },
      { h: "4. Delen met derden", p: ["Wij maken gebruik van zorgvuldig gekozen dienstverleners voor hosting (Vercel), database en opslag (Supabase) en e-mail (Resend). Deze partijen verwerken gegevens uitsluitend in onze opdracht. Gegevens kunnen hierbij buiten Suriname worden opgeslagen; wij kiezen partijen die passende beveiligingsmaatregelen hanteren."] },
      { h: "5. Beveiliging", p: ["Wij beveiligen je gegevens met versleutelde verbindingen, toegangscontrole per gebruiker (Row Level Security), beperkte beheerdersrechten en auditlogs. Betaalbewijzen en opdrachten worden privé opgeslagen en zijn alleen toegankelijk voor jou en geautoriseerde beheerders."] },
      { h: "6. Bewaartermijnen", p: ["Wij bewaren je gegevens zolang je account actief is. Certificaatgegevens bewaren wij langer, zodat de echtheid van je certificaat kan worden gecontroleerd. Betaalgegevens bewaren wij zo lang als nodig is voor onze administratieve en wettelijke verplichtingen."] },
      { h: "7. Jouw rechten", p: ["Je kunt je gegevens inzien en de meeste gegevens zelf wijzigen via je profiel. Je kunt ons ook vragen je gegevens te corrigeren, over te dragen of te verwijderen, voor zover wij deze niet wettelijk moeten bewaren. Neem hiervoor contact met ons op via de contactpagina."] },
      { h: "8. Cookies", p: ["Wij gebruiken alleen functionele cookies die nodig zijn om je ingelogd te houden en je taalkeuze te onthouden. Wij gebruiken geen tracking- of advertentiecookies."] },
      { h: "9. Contact", p: ["Vragen over privacy? Neem contact op met ARA AI Solutions via de contactpagina van ARA AI Academy."] },
    ],
  },
  en: {
    title: "Privacy policy",
    updated: "Last updated: 20 November 2026",
    intro:
      "ARA AI Solutions respects your privacy. This policy explains which personal data we process through ARA AI Academy, why, and what rights you have. We act in accordance with applicable Surinamese law and internationally recognised privacy principles such as data minimisation, purpose limitation and security.",
    sections: [
      { h: "1. Data we process", p: ["Account data: name, email address, phone number, country, preferred language and (optionally) profile picture.", "Enrollment and payment data: selected courses, payment method, amount, payment date, transaction reference and the proof of payment you upload.", "Learning data: progress, quiz and exam results, submitted assignments and certificates.", "Technical data: sign-in times and security logs (such as IP address for administrative actions)."] },
      { h: "2. Why we use this data", p: ["To manage your account, verify your payment, grant access to courses, track your progress, issue certificates and inform you about your enrollment (for example reminders before your access expires).", "We do not use your data for third-party advertising and never sell your data."] },
      { h: "3. Certificate verification", p: ["On the public verification page only your name, the course name, the completion date and the certificate status are visible to anyone who enters the certificate ID. No other data is shown."] },
      { h: "4. Sharing with third parties", p: ["We use carefully selected service providers for hosting (Vercel), database and storage (Supabase) and email (Resend). These parties process data only on our behalf. Data may be stored outside Suriname; we choose providers that apply appropriate security measures."] },
      { h: "5. Security", p: ["We protect your data with encrypted connections, per-user access control (Row Level Security), limited administrator rights and audit logs. Proofs of payment and assignments are stored privately and are only accessible to you and authorised administrators."] },
      { h: "6. Retention", p: ["We keep your data for as long as your account is active. Certificate data is kept longer so the authenticity of your certificate can be verified. Payment data is kept as long as required for our administrative and legal obligations."] },
      { h: "7. Your rights", p: ["You can view your data and change most of it yourself in your profile. You can also ask us to correct, export or delete your data, unless we are legally required to keep it. Contact us via the contact page."] },
      { h: "8. Cookies", p: ["We only use functional cookies required to keep you signed in and remember your language. We do not use tracking or advertising cookies."] },
      { h: "9. Contact", p: ["Questions about privacy? Contact ARA AI Solutions via the ARA AI Academy contact page."] },
    ],
  },
};
