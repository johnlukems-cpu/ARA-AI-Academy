/**
 * Default bilingual email templates. Administrators can override subject/body per
 * language in Admin → Settings → Email templates (stored in public.email_templates).
 *
 * Body syntax: blank line = new paragraph, **bold**, [text](url), and a call-to-action
 * button on its own line: [[button:Label|url]]. Variables: {{name}}.
 */
export type TemplateKey =
  | "welcome"
  | "enrollment_submitted"
  | "payment_submitted_admin"
  | "payment_approved"
  | "payment_rejected"
  | "access_activated"
  | "access_reminder"
  | "access_expired"
  | "access_extended"
  | "assignment_submitted"
  | "assignment_submitted_admin"
  | "assignment_reviewed"
  | "exam_result"
  | "certificate_issued"
  | "contact_admin";

type Template = { subject: string; body: string };

export const templateVariables: Record<TemplateKey, string[]> = {
  welcome: ["name", "dashboard_url", "courses_url"],
  enrollment_submitted: ["name", "course", "amount", "payment_url"],
  payment_submitted_admin: ["student", "email", "course", "amount", "method", "reference", "admin_url"],
  payment_approved: ["name", "course", "expires", "days", "course_url"],
  payment_rejected: ["name", "course", "reason", "payment_url"],
  access_activated: ["name", "course", "expires", "days", "course_url"],
  access_reminder: ["name", "course", "days", "expires", "course_url"],
  access_expired: ["name", "course", "contact_url"],
  access_extended: ["name", "course", "expires", "course_url"],
  assignment_submitted: ["name", "course", "assignment"],
  assignment_submitted_admin: ["student", "course", "assignment", "admin_url"],
  assignment_reviewed: ["name", "course", "assignment", "status", "feedback", "course_url"],
  exam_result: ["name", "course", "score", "result", "course_url"],
  certificate_issued: ["name", "course", "code", "certificate_url", "verify_url"],
  contact_admin: ["name", "email", "phone", "subject", "message"],
};

export const defaultTemplates: Record<TemplateKey, Record<"nl" | "en", Template>> = {
  welcome: {
    nl: {
      subject: "Welkom bij ARA AI Academy",
      body: "Hallo {{name}},\n\nJe e-mailadres is bevestigd en je studentenaccount is klaar. Kies een cursus om te beginnen; na goedkeuring van je betaling heb je 90 dagen toegang.\n\n[[button:Bekijk de cursussen|{{courses_url}}]]\n\nVeel leerplezier!\nHet team van ARA AI Academy",
    },
    en: {
      subject: "Welcome to ARA AI Academy",
      body: "Hello {{name}},\n\nYour email address is confirmed and your student account is ready. Choose a course to get started; once your payment is approved you get 90 days of access.\n\n[[button:Browse the courses|{{courses_url}}]]\n\nEnjoy learning!\nThe ARA AI Academy team",
    },
  },
  enrollment_submitted: {
    nl: {
      subject: "Je inschrijving voor {{course}} – betaalinstructies",
      body: "Hallo {{name}},\n\nWe hebben je inschrijving voor **{{course}}** ontvangen. Het cursusbedrag is **{{amount}}**.\n\nBekijk de betaalinstructies, betaal het bedrag en upload daarna je betaalbewijs. Je toegang wordt geactiveerd zodra wij je betaling hebben goedgekeurd.\n\n[[button:Betaalinstructies bekijken|{{payment_url}}]]",
    },
    en: {
      subject: "Your enrollment for {{course}} – payment instructions",
      body: "Hello {{name}},\n\nWe received your enrollment for **{{course}}**. The course fee is **{{amount}}**.\n\nView the payment instructions, pay the amount and then upload your proof of payment. Your access is activated as soon as we approve your payment.\n\n[[button:View payment instructions|{{payment_url}}]]",
    },
  },
  payment_submitted_admin: {
    nl: {
      subject: "Nieuwe betaling te beoordelen: {{student}} – {{course}}",
      body: "Er is een nieuwe betaling ingediend.\n\n**Student:** {{student}} ({{email}})\n**Cursus:** {{course}}\n**Bedrag:** {{amount}}\n**Methode:** {{method}}\n**Referentie:** {{reference}}\n\n[[button:Betaling beoordelen|{{admin_url}}]]",
    },
    en: {
      subject: "New payment to review: {{student}} – {{course}}",
      body: "A new payment has been submitted.\n\n**Student:** {{student}} ({{email}})\n**Course:** {{course}}\n**Amount:** {{amount}}\n**Method:** {{method}}\n**Reference:** {{reference}}\n\n[[button:Review payment|{{admin_url}}]]",
    },
  },
  payment_approved: {
    nl: {
      subject: "Je toegang tot {{course}} is geactiveerd",
      body: "Hallo {{name}},\n\nGoed nieuws: je betaling is goedgekeurd en je hebt nu **{{days}} dagen** toegang tot **{{course}}** (tot en met {{expires}}).\n\n[[button:Start met leren|{{course_url}}]]\n\nSucces met je cursus!",
    },
    en: {
      subject: "Your access to {{course}} is now active",
      body: "Hello {{name}},\n\nGood news: your payment has been approved and you now have **{{days}} days** of access to **{{course}}** (until {{expires}}).\n\n[[button:Start learning|{{course_url}}]]\n\nGood luck with your course!",
    },
  },
  payment_rejected: {
    nl: {
      subject: "Je betaling voor {{course}} kon niet worden goedgekeurd",
      body: "Hallo {{name}},\n\nHelaas konden we je betaling voor **{{course}}** niet goedkeuren.\n\n**Reden:** {{reason}}\n\nJe kunt een nieuwe betaling of een beter leesbaar betaalbewijs indienen.\n\n[[button:Opnieuw indienen|{{payment_url}}]]",
    },
    en: {
      subject: "Your payment for {{course}} could not be approved",
      body: "Hello {{name}},\n\nUnfortunately we could not approve your payment for **{{course}}**.\n\n**Reason:** {{reason}}\n\nYou can submit a new payment or a clearer proof of payment.\n\n[[button:Resubmit|{{payment_url}}]]",
    },
  },
  access_activated: {
    nl: {
      subject: "Je toegang tot {{course}} is geactiveerd",
      body: "Hallo {{name}},\n\nJe hebt nu **{{days}} dagen** toegang tot **{{course}}** (tot en met {{expires}}).\n\n[[button:Naar de cursus|{{course_url}}]]",
    },
    en: {
      subject: "Your access to {{course}} is now active",
      body: "Hello {{name}},\n\nYou now have **{{days}} days** of access to **{{course}}** (until {{expires}}).\n\n[[button:Go to the course|{{course_url}}]]",
    },
  },
  access_reminder: {
    nl: {
      subject: "Nog {{days}} dagen toegang tot {{course}}",
      body: "Hallo {{name}},\n\nJe toegang tot **{{course}}** verloopt over **{{days}} dagen** ({{expires}}). Plan je laatste lessen en het eindexamen op tijd in.\n\n[[button:Verder leren|{{course_url}}]]",
    },
    en: {
      subject: "{{days}} days of access left for {{course}}",
      body: "Hello {{name}},\n\nYour access to **{{course}}** expires in **{{days}} days** ({{expires}}). Plan your remaining lessons and the final exam in time.\n\n[[button:Continue learning|{{course_url}}]]",
    },
  },
  access_expired: {
    nl: {
      subject: "Je toegang tot {{course}} is verlopen",
      body: "Hallo {{name}},\n\nJe toegangsperiode voor **{{course}}** is verlopen. Je voortgang en resultaten blijven bewaard.\n\nWil je je toegang verlengen? Neem contact met ons op.\n\n[[button:Contact opnemen|{{contact_url}}]]",
    },
    en: {
      subject: "Your access to {{course}} has expired",
      body: "Hello {{name}},\n\nYour access period for **{{course}}** has ended. Your progress and results have been saved.\n\nWould you like to extend your access? Get in touch with us.\n\n[[button:Contact us|{{contact_url}}]]",
    },
  },
  access_extended: {
    nl: {
      subject: "Je toegang tot {{course}} is verlengd",
      body: "Hallo {{name}},\n\nJe toegang tot **{{course}}** is verlengd tot en met **{{expires}}**.\n\n[[button:Verder leren|{{course_url}}]]",
    },
    en: {
      subject: "Your access to {{course}} has been extended",
      body: "Hello {{name}},\n\nYour access to **{{course}}** has been extended until **{{expires}}**.\n\n[[button:Continue learning|{{course_url}}]]",
    },
  },
  assignment_submitted: {
    nl: {
      subject: "Opdracht ingeleverd: {{assignment}}",
      body: "Hallo {{name}},\n\nJe opdracht **{{assignment}}** voor **{{course}}** is ingeleverd. Je ontvangt bericht zodra deze is beoordeeld.",
    },
    en: {
      subject: "Assignment submitted: {{assignment}}",
      body: "Hello {{name}},\n\nYour assignment **{{assignment}}** for **{{course}}** has been submitted. You will be notified once it has been reviewed.",
    },
  },
  assignment_submitted_admin: {
    nl: {
      subject: "Nieuwe opdracht te beoordelen: {{student}}",
      body: "**{{student}}** heeft de opdracht **{{assignment}}** ingeleverd voor **{{course}}**.\n\n[[button:Beoordelen|{{admin_url}}]]",
    },
    en: {
      subject: "New assignment to review: {{student}}",
      body: "**{{student}}** submitted the assignment **{{assignment}}** for **{{course}}**.\n\n[[button:Review|{{admin_url}}]]",
    },
  },
  assignment_reviewed: {
    nl: {
      subject: "Je opdracht is beoordeeld: {{assignment}}",
      body: "Hallo {{name}},\n\nJe opdracht **{{assignment}}** voor **{{course}}** is beoordeeld: **{{status}}**.\n\n{{feedback}}\n\n[[button:Bekijk in de cursus|{{course_url}}]]",
    },
    en: {
      subject: "Your assignment has been reviewed: {{assignment}}",
      body: "Hello {{name}},\n\nYour assignment **{{assignment}}** for **{{course}}** has been reviewed: **{{status}}**.\n\n{{feedback}}\n\n[[button:View in the course|{{course_url}}]]",
    },
  },
  exam_result: {
    nl: {
      subject: "Je examenresultaat voor {{course}}",
      body: "Hallo {{name}},\n\nJe hebt het eindexamen van **{{course}}** gemaakt. Je score is **{{score}}%**: **{{result}}**.\n\n[[button:Bekijk je resultaat|{{course_url}}]]",
    },
    en: {
      subject: "Your exam result for {{course}}",
      body: "Hello {{name}},\n\nYou completed the final exam of **{{course}}**. Your score is **{{score}}%**: **{{result}}**.\n\n[[button:View your result|{{course_url}}]]",
    },
  },
  certificate_issued: {
    nl: {
      subject: "Gefeliciteerd! Je certificaat voor {{course}}",
      body: "Hallo {{name}},\n\nGefeliciteerd met het afronden van **{{course}}**! Je digitale certificaat staat klaar.\n\n**Certificaat-ID:** {{code}}\n\n[[button:Download je certificaat|{{certificate_url}}]]\n\nWerkgevers kunnen je certificaat controleren via {{verify_url}}.",
    },
    en: {
      subject: "Congratulations! Your certificate for {{course}}",
      body: "Hello {{name}},\n\nCongratulations on completing **{{course}}**! Your digital certificate is ready.\n\n**Certificate ID:** {{code}}\n\n[[button:Download your certificate|{{certificate_url}}]]\n\nEmployers can verify your certificate at {{verify_url}}.",
    },
  },
  contact_admin: {
    nl: {
      subject: "Contactformulier: {{subject}}",
      body: "**Naam:** {{name}}\n**E-mail:** {{email}}\n**Telefoon:** {{phone}}\n\n{{message}}",
    },
    en: {
      subject: "Contact form: {{subject}}",
      body: "**Name:** {{name}}\n**Email:** {{email}}\n**Phone:** {{phone}}\n\n{{message}}",
    },
  },
};

export const templateKeys = Object.keys(defaultTemplates) as TemplateKey[];
