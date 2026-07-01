export interface competitorDetail {
  slug: string;
  name: string;
  pricingModel: string;
  filingPosture: string;
  integrations: string[];
  keyVulnerability: string;
  verdactAdvantage: string;
  featureComparison: {
    feature: string;
    competitor: boolean | string;
    verdact: boolean | string;
  }[];
}

export const COMPETITOR_DETAILS: competitorDetail[] = [
  {
    slug: 'chargeflow',
    name: 'Chargeflow',
    pricingModel: '25% success fee (pay only when you win)',
    filingPosture: 'Full Autopilot (auto-submits disputes directly without merchant review)',
    integrations: ['Stripe', 'Shopify Payments', 'PayPal'],
    keyVulnerability: 'Auto-submitting disputes without human review risks sending incorrect or incomplete evidence for high-context SaaS/service disputes, leading to irreversible losses.',
    verdactAdvantage: 'Verdact costs a flat monthly fee ($49 flat) with zero success fees, saving thousands in revenue. It enforces a strict approval lock — nothing is filed to Stripe without your explicit review and approval on the workbench.',
    featureComparison: [
      { feature: 'Pricing Model', competitor: '25% Success Fee', verdact: 'Flat $49/mo (no cuts)' },
      { feature: 'Filing Workflow', competitor: 'Autopilot (No Review)', verdact: 'Strict Approval Lock' },
      { feature: 'Evidence Workbench', competitor: 'None (Black box)', verdact: 'Guided 3-stage UI' },
      { feature: 'Slack Integration', competitor: 'No', verdact: 'Yes (Direct import)' },
      { feature: 'VAMP Monitor', competitor: 'Risk score only', verdact: 'Stripe 0.75% Line Alert' },
      { feature: 'Stripe API Native', competitor: 'Yes', verdact: 'Yes' }
    ]
  },
  {
    slug: 'disputifier',
    name: 'Disputifier',
    pricingModel: '10% to 20% success fee or custom plans',
    filingPosture: 'Automated autopilot or manual templates',
    integrations: ['Stripe', 'Shopify Payments'],
    keyVulnerability: 'Percentage-based success fees penalize you as your business scales. Standard templates are too generic for custom SaaS subscription disputes.',
    verdactAdvantage: 'Verdact provides custom evidence-signal builders (Chain of Intent) specifically optimized for B2B SaaS/service business models at a fraction of the cost.',
    featureComparison: [
      { feature: 'Pricing Model', competitor: '10-20% Success Fee', verdact: 'Flat $49/mo (no cuts)' },
      { feature: 'Filing Workflow', competitor: 'Autopilot or template', verdact: 'Strict Approval Lock' },
      { feature: 'Evidence Workbench', competitor: 'Generic templates', verdact: 'Guided 3-stage UI' },
      { feature: 'Slack Integration', competitor: 'No', verdact: 'Yes (Direct import)' },
      { feature: 'VAMP Monitor', competitor: 'Basic alert', verdact: 'Stripe 0.75% Line Alert' },
      { feature: 'Stripe API Native', competitor: 'Yes', verdact: 'Yes' }
    ]
  },
  {
    slug: 'revano',
    name: 'Revano',
    pricingModel: 'Flat €29/mo (approx. $32/mo)',
    filingPosture: 'Manual PDF export and upload',
    integrations: ['Server-side API logs'],
    keyVulnerability: 'Revano is not connected to Stripe via API. It generates a PDF report that the merchant must manually download and upload to the Stripe dashboard. Highly friction-heavy.',
    verdactAdvantage: 'Verdact integrates natively via Stripe Standard Connect, allowing you to build, review, and file your dispute packages directly to Stripe in one click without downloading/uploading PDF files.',
    featureComparison: [
      { feature: 'Pricing Model', competitor: 'Flat €29/mo', verdact: 'Flat $49/mo' },
      { feature: 'Filing Workflow', competitor: 'Manual PDF Upload', verdact: '1-Click API Submit' },
      { feature: 'Evidence Workbench', competitor: 'Yes', verdact: 'Yes' },
      { feature: 'Slack Integration', competitor: 'No', verdact: 'Yes (Direct import)' },
      { feature: 'Stripe Integration', competitor: 'No (API logging only)', verdact: 'Yes (Direct Connect)' },
      { feature: 'VAMP Monitor', competitor: 'No', verdact: 'Stripe 0.75% Line Alert' }
    ]
  }
];

export function getCompetitorDetail(slug: string): competitorDetail | undefined {
  const normSlug = slug.toLowerCase().trim();
  return COMPETITOR_DETAILS.find((c) => c.slug === normSlug);
}
