// Initial ARA AI Academy course catalog (curriculum structure, NL + EN).
// Used by scripts/generate-seed.mjs to produce supabase/seed.sql.
// All courses are seeded as DRAFT with placeholder lessons; publish only after
// the learning materials have been written and reviewed.
//
// Lesson tuple: [type, nl title, en title]
// Each module automatically gets a module quiz lesson at the end.

export const catalog = [
  {
    slug: 'ai-fundamentals',
    level: 'beginner',
    hours: 24,
    weeks: 6,
    featured: true,
    nl: {
      title: 'AI Fundamentals',
      subtitle: 'De basis van kunstmatige intelligentie, helder uitgelegd',
      description:
        'Een praktische introductie tot kunstmatige intelligentie, machine learning en generatieve AI. Je leert hoe AI werkt, waar het vandaag al wordt toegepast en hoe je het verantwoord inzet in je werk en bedrijf.',
      objectives: [
        'Uitleggen wat AI, machine learning en generatieve AI zijn',
        'Herkennen waar AI in het dagelijks leven en bedrijfsleven wordt gebruikt',
        'De kansen en beperkingen van AI-tools realistisch inschatten',
        'AI verantwoord en veilig gebruiken',
      ],
      audience: 'Iedereen die zonder technische voorkennis wil begrijpen wat AI is en hoe je het praktisch inzet.',
    },
    en: {
      title: 'AI Fundamentals',
      subtitle: 'The foundations of artificial intelligence, clearly explained',
      description:
        'A practical introduction to artificial intelligence, machine learning and generative AI. Learn how AI works, where it is already used today and how to apply it responsibly in your work and business.',
      objectives: [
        'Explain what AI, machine learning and generative AI are',
        'Recognise where AI is used in daily life and business',
        'Realistically assess the opportunities and limits of AI tools',
        'Use AI responsibly and safely',
      ],
      audience: 'Anyone who wants to understand what AI is and how to use it in practice, without technical background.',
    },
    modules: [
      {
        nl: 'Wat is kunstmatige intelligentie?',
        en: 'What is artificial intelligence?',
        lessons: [
          ['video', 'Welkom bij AI Fundamentals', 'Welcome to AI Fundamentals'],
          ['text', 'Een korte geschiedenis van AI', 'A short history of AI'],
          ['text', 'Soorten AI: smal, algemeen en generatief', 'Types of AI: narrow, general and generative'],
        ],
      },
      {
        nl: 'Machine learning begrijpen',
        en: 'Understanding machine learning',
        lessons: [
          ['video', 'Hoe machines leren van data', 'How machines learn from data'],
          ['text', 'Supervised, unsupervised en reinforcement learning', 'Supervised, unsupervised and reinforcement learning'],
          ['pdf', 'Werkblad: data en patronen', 'Worksheet: data and patterns'],
        ],
      },
      {
        nl: 'Generatieve AI in de praktijk',
        en: 'Generative AI in practice',
        lessons: [
          ['video', 'Hoe grote taalmodellen werken', 'How large language models work'],
          ['text', 'Tekst, beeld en audio genereren', 'Generating text, images and audio'],
          ['external', 'Verkenning: populaire AI-tools', 'Exploration: popular AI tools'],
        ],
      },
      {
        nl: 'Verantwoord AI-gebruik',
        en: 'Responsible use of AI',
        lessons: [
          ['text', 'Privacy, bias en betrouwbaarheid', 'Privacy, bias and reliability'],
          ['text', 'AI-beleid voor je organisatie', 'AI policy for your organisation'],
        ],
        assignment: ['Praktijkopdracht: AI-kansen in jouw werk', 'Practical assignment: AI opportunities in your work'],
      },
    ],
    exam: [
      {
        type: 'single_choice',
        nl: 'Wat is machine learning?',
        en: 'What is machine learning?',
        options: [
          ['Een methode waarbij computers patronen leren uit data', 'A method where computers learn patterns from data', true],
          ['Een programmeertaal voor robots', 'A programming language for robots', false],
          ['Een type computerhardware', 'A type of computer hardware', false],
          ['Een database voor afbeeldingen', 'A database for images', false],
        ],
      },
      {
        type: 'true_false',
        nl: 'Generatieve AI kan nieuwe tekst of afbeeldingen maken op basis van patronen in trainingsdata.',
        en: 'Generative AI can create new text or images based on patterns in training data.',
        options: [
          ['Waar', 'True', true],
          ['Onwaar', 'False', false],
        ],
      },
      {
        type: 'multiple_choice',
        nl: 'Welke van de volgende zijn risico’s van AI-gebruik? (meerdere antwoorden)',
        en: 'Which of the following are risks of using AI? (multiple answers)',
        options: [
          ['Onjuiste of verzonnen antwoorden', 'Incorrect or fabricated answers', true],
          ['Vooroordelen (bias) uit trainingsdata', 'Bias inherited from training data', true],
          ['Lekken van vertrouwelijke gegevens', 'Leaking confidential data', true],
          ['AI werkt altijd zonder fouten', 'AI always works without errors', false],
        ],
      },
      {
        type: 'single_choice',
        nl: 'Bij welk type machine learning leert een model van gelabelde voorbeelden?',
        en: 'In which type of machine learning does a model learn from labelled examples?',
        options: [
          ['Supervised learning', 'Supervised learning', true],
          ['Unsupervised learning', 'Unsupervised learning', false],
          ['Reinforcement learning', 'Reinforcement learning', false],
        ],
      },
      {
        type: 'short_answer',
        nl: 'Waar staat de afkorting "AI" voor? (in het Engels)',
        en: 'What does the abbreviation "AI" stand for?',
        accepted: { nl: ['artificial intelligence', 'kunstmatige intelligentie'], en: ['artificial intelligence'] },
      },
      {
        type: 'true_false',
        nl: 'Het is veilig om vertrouwelijke klantgegevens zonder toestemming in een openbare AI-chatbot te plakken.',
        en: 'It is safe to paste confidential customer data into a public AI chatbot without permission.',
        options: [
          ['Waar', 'True', false],
          ['Onwaar', 'False', true],
        ],
      },
    ],
  },
  {
    slug: 'chatgpt-professional-mastery',
    level: 'beginner',
    hours: 20,
    weeks: 5,
    featured: true,
    nl: {
      title: 'ChatGPT Professional Mastery',
      subtitle: 'Werk slimmer met ChatGPT',
      description:
        'Leer ChatGPT professioneel inzetten voor productiviteit, onderzoek, zakelijke communicatie en probleemoplossing. Met concrete prompttechnieken en praktijkvoorbeelden uit het bedrijfsleven.',
      objectives: [
        'Effectieve prompts schrijven met context, rol en doel',
        'ChatGPT gebruiken voor onderzoek, samenvattingen en analyses',
        'Professionele e-mails, rapporten en presentaties opstellen',
        'Resultaten kritisch controleren en verbeteren',
      ],
      audience: 'Professionals, ondernemers en studenten die dagelijks met tekst, informatie en communicatie werken.',
    },
    en: {
      title: 'ChatGPT Professional Mastery',
      subtitle: 'Work smarter with ChatGPT',
      description:
        'Learn to use ChatGPT professionally for productivity, research, business communication and problem-solving. With concrete prompting techniques and real-world business examples.',
      objectives: [
        'Write effective prompts with context, role and goal',
        'Use ChatGPT for research, summaries and analysis',
        'Draft professional emails, reports and presentations',
        'Critically verify and improve results',
      ],
      audience: 'Professionals, entrepreneurs and students who work with text, information and communication every day.',
    },
    modules: [
      {
        nl: 'Aan de slag met ChatGPT',
        en: 'Getting started with ChatGPT',
        lessons: [
          ['video', 'De interface en mogelijkheden', 'The interface and capabilities'],
          ['text', 'Accounts, abonnementen en privacy-instellingen', 'Accounts, plans and privacy settings'],
        ],
      },
      {
        nl: 'Prompt engineering',
        en: 'Prompt engineering',
        lessons: [
          ['video', 'De anatomie van een goede prompt', 'The anatomy of a good prompt'],
          ['text', 'Rollen, voorbeelden en stapsgewijs denken', 'Roles, examples and step-by-step reasoning'],
          ['pdf', 'Promptbibliotheek voor professionals', 'Prompt library for professionals'],
        ],
      },
      {
        nl: 'Productiviteit en communicatie',
        en: 'Productivity and communication',
        lessons: [
          ['video', 'E-mails, rapporten en notulen', 'Emails, reports and minutes'],
          ['text', 'Onderzoek en samenvattingen', 'Research and summaries'],
          ['text', 'Data analyseren met ChatGPT', 'Analysing data with ChatGPT'],
        ],
      },
      {
        nl: 'Problemen oplossen en workflows',
        en: 'Problem-solving and workflows',
        lessons: [
          ['text', 'Brainstormen en besluitvorming', 'Brainstorming and decision-making'],
          ['text', 'Eigen GPT’s en vaste instructies', 'Custom GPTs and standing instructions'],
        ],
        assignment: ['Praktijkopdracht: jouw ChatGPT-werkproces', 'Practical assignment: your ChatGPT workflow'],
      },
    ],
  },
  {
    slug: 'claude-ai-mastery',
    level: 'intermediate',
    hours: 20,
    weeks: 5,
    featured: true,
    nl: {
      title: 'Claude AI Mastery',
      subtitle: 'Onderzoek, schrijven en analyse met Claude',
      description:
        'Gebruik Claude voor onderzoek, schrijven, documentanalyse, programmeren en zakelijke workflows. Je leert werken met lange documenten, projecten en gestructureerde opdrachten.',
      objectives: [
        'Claude inzetten voor onderzoek en het analyseren van lange documenten',
        'Professionele teksten schrijven en redigeren',
        'Eenvoudige code laten schrijven en uitleggen',
        'Herbruikbare workflows opzetten voor je organisatie',
      ],
      audience: 'Kenniswerkers, analisten, schrijvers en ondernemers die met veel informatie en documenten werken.',
    },
    en: {
      title: 'Claude AI Mastery',
      subtitle: 'Research, writing and analysis with Claude',
      description:
        'Use Claude for research, writing, document analysis, coding and business workflows. Learn to work with long documents, projects and structured instructions.',
      objectives: [
        'Use Claude for research and analysing long documents',
        'Write and edit professional texts',
        'Have simple code written and explained',
        'Set up reusable workflows for your organisation',
      ],
      audience: 'Knowledge workers, analysts, writers and entrepreneurs who work with lots of information and documents.',
    },
    modules: [
      {
        nl: 'Kennismaking met Claude',
        en: 'Introduction to Claude',
        lessons: [
          ['video', 'Wat Claude anders maakt', 'What makes Claude different'],
          ['text', 'Gesprekken, projecten en bestanden', 'Conversations, projects and files'],
        ],
      },
      {
        nl: 'Onderzoek en documentanalyse',
        en: 'Research and document analysis',
        lessons: [
          ['video', 'Lange documenten samenvatten en vergelijken', 'Summarising and comparing long documents'],
          ['text', 'Bronnen controleren en citeren', 'Verifying and citing sources'],
          ['pdf', 'Checklist documentanalyse', 'Document analysis checklist'],
        ],
      },
      {
        nl: 'Schrijven en programmeren',
        en: 'Writing and coding',
        lessons: [
          ['text', 'Schrijfstijl en toon sturen', 'Steering writing style and tone'],
          ['video', 'Code laten schrijven en uitleggen', 'Having code written and explained'],
        ],
      },
      {
        nl: 'Zakelijke workflows',
        en: 'Business workflows',
        lessons: [
          ['text', 'Herbruikbare instructies en sjablonen', 'Reusable instructions and templates'],
          ['text', 'Claude veilig inzetten in je team', 'Using Claude safely in your team'],
        ],
        assignment: ['Praktijkopdracht: documentanalyse voor je bedrijf', 'Practical assignment: document analysis for your business'],
      },
    ],
  },
  {
    slug: 'ai-automation-specialist',
    level: 'intermediate',
    hours: 30,
    weeks: 8,
    nl: {
      title: 'AI Automation Specialist',
      subtitle: 'Automatiseer werkprocessen met Make, Zapier en n8n',
      description:
        'Een introductie tot workflow-automatisering met Make, Zapier en n8n. Je leert repetitieve taken automatiseren en AI koppelen aan de tools die je organisatie al gebruikt.',
      objectives: [
        'Processen analyseren en geschikt maken voor automatisering',
        'Workflows bouwen in Make, Zapier en n8n',
        'AI-stappen toevoegen aan automatiseringen',
        'Automatiseringen testen, bewaken en documenteren',
      ],
      audience: 'Ondernemers, operations-medewerkers en IT-geïnteresseerden die tijd willen besparen op routinetaken.',
    },
    en: {
      title: 'AI Automation Specialist',
      subtitle: 'Automate workflows with Make, Zapier and n8n',
      description:
        'An introduction to workflow automation using Make, Zapier and n8n. Learn to automate repetitive tasks and connect AI to the tools your organisation already uses.',
      objectives: [
        'Analyse processes and prepare them for automation',
        'Build workflows in Make, Zapier and n8n',
        'Add AI steps to automations',
        'Test, monitor and document automations',
      ],
      audience: 'Entrepreneurs, operations staff and tech-minded professionals who want to save time on routine tasks.',
    },
    modules: [
      {
        nl: 'Basisprincipes van automatisering',
        en: 'Automation fundamentals',
        lessons: [
          ['video', 'Triggers, acties en data', 'Triggers, actions and data'],
          ['text', 'Processen in kaart brengen', 'Mapping your processes'],
        ],
      },
      {
        nl: 'Zapier en Make',
        en: 'Zapier and Make',
        lessons: [
          ['video', 'Je eerste Zap bouwen', 'Building your first Zap'],
          ['video', 'Scenario’s in Make', 'Scenarios in Make'],
          ['pdf', 'Vergelijking van automatiseringsplatformen', 'Comparison of automation platforms'],
        ],
      },
      {
        nl: 'n8n en geavanceerde workflows',
        en: 'n8n and advanced workflows',
        lessons: [
          ['video', 'Introductie n8n', 'Introduction to n8n'],
          ['text', 'API’s, webhooks en foutafhandeling', 'APIs, webhooks and error handling'],
        ],
      },
      {
        nl: 'AI in je automatiseringen',
        en: 'AI in your automations',
        lessons: [
          ['text', 'Tekst classificeren en samenvatten in een workflow', 'Classifying and summarising text in a workflow'],
          ['text', 'Beheer, beveiliging en kosten', 'Governance, security and cost'],
        ],
        assignment: ['Praktijkopdracht: automatiseer een bedrijfsproces', 'Practical assignment: automate a business process'],
      },
    ],
  },
  {
    slug: 'ai-agents-development',
    level: 'advanced',
    hours: 36,
    weeks: 10,
    nl: {
      title: 'AI Agents Development',
      subtitle: 'AI-agents begrijpen en bouwen voor de praktijk',
      description:
        'Begrijp hoe AI-agents werken en bouw agents voor praktische bedrijfstoepassingen: van planning en toolgebruik tot geheugen, evaluatie en veilige inzet.',
      objectives: [
        'Uitleggen hoe AI-agents plannen, tools gebruiken en beslissingen nemen',
        'Een eenvoudige agent ontwerpen en bouwen',
        'Agents koppelen aan externe tools en data',
        'Agents evalueren en veilig in productie brengen',
      ],
      audience: 'Gevorderde gebruikers, ontwikkelaars en automatiseringsspecialisten met basiskennis van AI-tools.',
    },
    en: {
      title: 'AI Agents Development',
      subtitle: 'Understand and build AI agents for real business use',
      description:
        'Understand how AI agents work and build agents for practical business applications: from planning and tool use to memory, evaluation and safe deployment.',
      objectives: [
        'Explain how AI agents plan, use tools and make decisions',
        'Design and build a simple agent',
        'Connect agents to external tools and data',
        'Evaluate agents and deploy them safely',
      ],
      audience: 'Advanced users, developers and automation specialists with basic knowledge of AI tools.',
    },
    modules: [
      {
        nl: 'Wat zijn AI-agents?',
        en: 'What are AI agents?',
        lessons: [
          ['video', 'Van chatbot naar agent', 'From chatbot to agent'],
          ['text', 'Architectuur: model, tools, geheugen', 'Architecture: model, tools, memory'],
        ],
      },
      {
        nl: 'Tools en integraties',
        en: 'Tools and integrations',
        lessons: [
          ['video', 'Tool use en function calling', 'Tool use and function calling'],
          ['text', 'Kennisbronnen koppelen (RAG)', 'Connecting knowledge sources (RAG)'],
        ],
      },
      {
        nl: 'Een agent bouwen',
        en: 'Building an agent',
        lessons: [
          ['video', 'Stap voor stap: een klantenservice-agent', 'Step by step: a customer service agent'],
          ['pdf', 'Ontwerpsjabloon voor agents', 'Agent design template'],
        ],
      },
      {
        nl: 'Evaluatie en veilige inzet',
        en: 'Evaluation and safe deployment',
        lessons: [
          ['text', 'Agents testen en evalueren', 'Testing and evaluating agents'],
          ['text', 'Menselijk toezicht en risicobeheer', 'Human oversight and risk management'],
        ],
        assignment: ['Praktijkopdracht: ontwerp een bedrijfsagent', 'Practical assignment: design a business agent'],
      },
    ],
  },
  {
    slug: 'ai-for-business-entrepreneurship',
    level: 'beginner',
    hours: 24,
    weeks: 6,
    featured: true,
    nl: {
      title: 'AI for Business and Entrepreneurship',
      subtitle: 'AI toepassen in elk onderdeel van je bedrijf',
      description:
        'Pas AI toe in marketing, financiën, administratie, klantenservice en bedrijfsvoering. Met praktijkcases die aansluiten bij ondernemers en organisaties in Suriname en de regio.',
      objectives: [
        'Kansen voor AI in je eigen bedrijf herkennen',
        'AI inzetten voor marketing, administratie en klantenservice',
        'De kosten en baten van AI-oplossingen afwegen',
        'Een AI-actieplan voor je organisatie opstellen',
      ],
      audience: 'Ondernemers, managers en zzp’ers die AI concreet willen inzetten om hun bedrijf te laten groeien.',
    },
    en: {
      title: 'AI for Business and Entrepreneurship',
      subtitle: 'Apply AI across every part of your business',
      description:
        'Apply AI in marketing, finance, administration, customer service and business operations. With practical cases relevant to entrepreneurs and organisations in Suriname and the region.',
      objectives: [
        'Identify AI opportunities in your own business',
        'Use AI for marketing, administration and customer service',
        'Weigh the costs and benefits of AI solutions',
        'Draft an AI action plan for your organisation',
      ],
      audience: 'Entrepreneurs, managers and freelancers who want to use AI concretely to grow their business.',
    },
    modules: [
      {
        nl: 'AI-strategie voor ondernemers',
        en: 'AI strategy for entrepreneurs',
        lessons: [
          ['video', 'Waar AI waarde toevoegt', 'Where AI adds value'],
          ['text', 'Een AI-kansenkaart maken', 'Creating an AI opportunity map'],
        ],
      },
      {
        nl: 'Marketing en verkoop',
        en: 'Marketing and sales',
        lessons: [
          ['video', 'Klantinzicht en campagnes met AI', 'Customer insight and campaigns with AI'],
          ['text', 'Offertes en verkoopteksten', 'Proposals and sales copy'],
        ],
      },
      {
        nl: 'Financiën, administratie en klantenservice',
        en: 'Finance, administration and customer service',
        lessons: [
          ['text', 'Administratieve processen versnellen', 'Speeding up administrative processes'],
          ['text', 'AI in klantenservice', 'AI in customer service'],
          ['pdf', 'Rekenmodel kosten en baten', 'Cost-benefit calculator'],
        ],
      },
      {
        nl: 'Implementatie',
        en: 'Implementation',
        lessons: [
          ['text', 'Je team meenemen in verandering', 'Bringing your team along'],
          ['text', 'Beleid, privacy en risico’s', 'Policy, privacy and risks'],
        ],
        assignment: ['Praktijkopdracht: AI-actieplan voor je bedrijf', 'Practical assignment: AI action plan for your business'],
      },
    ],
  },
  {
    slug: 'no-code-app-development',
    level: 'intermediate',
    hours: 30,
    weeks: 8,
    nl: {
      title: 'No-Code App Development',
      subtitle: 'Bouw apps en bedrijfstools zonder te programmeren',
      description:
        'Bouw applicaties en bedrijfstools met no-code en low-code technologie. Van idee en datamodel tot een werkende app die je collega’s of klanten kunnen gebruiken.',
      objectives: [
        'Een app-idee vertalen naar schermen en een datamodel',
        'Werkende apps bouwen met no-code platformen',
        'AI-functies toevoegen aan je apps',
        'Apps testen, publiceren en onderhouden',
      ],
      audience: 'Ondernemers, projectleiders en creatieve professionals die zelf digitale tools willen bouwen.',
    },
    en: {
      title: 'No-Code App Development',
      subtitle: 'Build apps and business tools without coding',
      description:
        'Build applications and business tools with no-code and low-code technologies. From idea and data model to a working app your colleagues or customers can use.',
      objectives: [
        'Translate an app idea into screens and a data model',
        'Build working apps with no-code platforms',
        'Add AI features to your apps',
        'Test, publish and maintain apps',
      ],
      audience: 'Entrepreneurs, project leads and creative professionals who want to build their own digital tools.',
    },
    modules: [
      {
        nl: 'Van idee naar ontwerp',
        en: 'From idea to design',
        lessons: [
          ['video', 'Het no-code landschap', 'The no-code landscape'],
          ['text', 'Gebruikers, schermen en data', 'Users, screens and data'],
        ],
      },
      {
        nl: 'Je eerste app bouwen',
        en: 'Building your first app',
        lessons: [
          ['video', 'Datamodel en formulieren', 'Data model and forms'],
          ['video', 'Logica en automatisering', 'Logic and automation'],
        ],
      },
      {
        nl: 'AI-functies toevoegen',
        en: 'Adding AI features',
        lessons: [
          ['text', 'AI-assistenten in je app', 'AI assistants in your app'],
          ['pdf', 'Overzicht no-code AI-integraties', 'Overview of no-code AI integrations'],
        ],
      },
      {
        nl: 'Publiceren en beheren',
        en: 'Publishing and maintenance',
        lessons: [
          ['text', 'Testen met echte gebruikers', 'Testing with real users'],
          ['text', 'Beveiliging en onderhoud', 'Security and maintenance'],
        ],
        assignment: ['Praktijkopdracht: bouw een bedrijfstool', 'Practical assignment: build a business tool'],
      },
    ],
  },
  {
    slug: 'ai-content-creation-digital-marketing',
    level: 'beginner',
    hours: 24,
    weeks: 6,
    nl: {
      title: 'AI Content Creation and Digital Marketing',
      subtitle: 'Content, branding en marketing met AI',
      description:
        'Gebruik AI voor social media, contentcreatie, branding en digitale marketing. Je leert sneller betere content maken die past bij jouw merk en doelgroep.',
      objectives: [
        'Een contentstrategie opstellen met hulp van AI',
        'Teksten, beelden en video’s maken met AI-tools',
        'Een consistente merkstem bewaken',
        'Resultaten meten en campagnes verbeteren',
      ],
      audience: 'Marketeers, contentmakers, ondernemers en social media managers.',
    },
    en: {
      title: 'AI Content Creation and Digital Marketing',
      subtitle: 'Content, branding and marketing with AI',
      description:
        'Use AI for social media, content creation, branding and digital marketing. Learn to create better content faster that fits your brand and audience.',
      objectives: [
        'Build a content strategy with the help of AI',
        'Create text, images and video with AI tools',
        'Maintain a consistent brand voice',
        'Measure results and improve campaigns',
      ],
      audience: 'Marketers, content creators, entrepreneurs and social media managers.',
    },
    modules: [
      {
        nl: 'Contentstrategie met AI',
        en: 'Content strategy with AI',
        lessons: [
          ['video', 'Doelgroep en merkstem', 'Audience and brand voice'],
          ['text', 'Een contentkalender plannen', 'Planning a content calendar'],
        ],
      },
      {
        nl: 'Tekst en beeld maken',
        en: 'Creating text and visuals',
        lessons: [
          ['video', 'Social media posts en captions', 'Social media posts and captions'],
          ['video', 'Beelden genereren en bewerken', 'Generating and editing images'],
          ['pdf', 'Promptgids voor marketeers', 'Prompt guide for marketers'],
        ],
      },
      {
        nl: 'Video en campagnes',
        en: 'Video and campaigns',
        lessons: [
          ['text', 'Korte video’s met AI', 'Short-form video with AI'],
          ['text', 'Advertentiecampagnes opzetten', 'Setting up ad campaigns'],
        ],
      },
      {
        nl: 'Meten en verbeteren',
        en: 'Measure and improve',
        lessons: [
          ['text', 'Analytics en rapportage', 'Analytics and reporting'],
          ['text', 'Auteursrecht en ethiek van AI-content', 'Copyright and ethics of AI content'],
        ],
        assignment: ['Praktijkopdracht: een AI-contentcampagne', 'Practical assignment: an AI content campaign'],
      },
    ],
  },
];
