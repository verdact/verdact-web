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
    verdactAdvantage: 'Verdact never forces you into one pricing model: you choose how you pay, and it’s free during beta. It also enforces a strict approval lock: nothing is filed to Stripe without your explicit review and approval on the workbench.',
    featureComparison: [
      { feature: 'Pricing Model', competitor: '25% Success Fee', verdact: 'Your choice (free in beta)' },
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
    verdactAdvantage: 'Verdact provides custom evidence-signal builders (Chain of Intent) specifically optimized for B2B SaaS/service business models, and it’s free during beta.',
    featureComparison: [
      { feature: 'Pricing Model', competitor: '10-20% Success Fee', verdact: 'Your choice (free in beta)' },
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
    verdactAdvantage: 'Verdact integrates natively via Stripe Standard Connect, letting you build, review, and (once you approve) submit your dispute packet directly to Stripe without downloading/uploading PDF files.',
    featureComparison: [
      { feature: 'Pricing Model', competitor: 'Flat €29/mo', verdact: 'Your choice (free in beta)' },
      { feature: 'Filing Workflow', competitor: 'Manual PDF Upload', verdact: 'Guided Stripe Submit (beta)' },
      { feature: 'Evidence Workbench', competitor: 'Yes', verdact: 'Yes' },
      { feature: 'Slack Integration', competitor: 'No', verdact: 'Yes (Direct import)' },
      { feature: 'Stripe Integration', competitor: 'No (API logging only)', verdact: 'Yes (Direct Connect)' },
      { feature: 'VAMP Monitor', competitor: 'No', verdact: 'Stripe 0.75% Line Alert' }
    ]
  },
  {
    slug: 'stripe-smart-disputes',
    name: 'Stripe Smart Disputes (Radar)',
    pricingModel: '30% success fee on won disputes, plus a $15 dispute-received fee and a $15 manual-countering fee (refunded on a win)',
    filingPosture: 'Automated CE 3.0 evidence extraction (10.4 Fraud only)',
    integrations: ['Stripe Native'],
    keyVulnerability: 'Stripe Smart Disputes explicitly excludes Reason Code 13.1 (Services Not Rendered), the primary dispute type for B2B SaaS and digital services. It only defends against 10.4 Card-Absent Fraud.',
    verdactAdvantage: 'Verdact specifically defends against 13.1 (Service Not Rendered) using our Chain of Intent architecture, giving SaaS businesses coverage Stripe’s own tool doesn’t offer.',
    featureComparison: [
      { feature: 'Pricing Model', competitor: '30% Success Fee + Base Fees', verdact: 'Your choice (free in beta)' },
      { feature: 'Filing Workflow', competitor: 'Auto-Extract Logs', verdact: 'Strict Approval Lock' },
      { feature: 'Visa 13.1 Defense', competitor: 'No', verdact: 'Yes (Chain of Intent)' },
      { feature: 'Comms Ingestion', competitor: 'No', verdact: 'Yes (Slack import; email via upload)' },
      { feature: 'VAMP Monitor', competitor: 'No', verdact: 'Stripe 0.75% Line Alert' },
      { feature: 'Stripe API Native', competitor: 'Yes', verdact: 'Yes' }
    ]
  },
  {
    slug: 'justt',
    name: 'Justt',
    pricingModel: 'Success fee based (percentage of recovered funds)',
    filingPosture: 'Full autopilot / Outsourced managed service',
    integrations: ['Stripe', 'Adyen', 'Braintree'],
    keyVulnerability: 'Justt targets enterprise-scale merchants. Their automated templates often fail to capture the nuanced proof of delivery (like Slack sign-offs or GitHub commits) required to win B2B SaaS disputes.',
    verdactAdvantage: 'Verdact provides a specialized Evidence Workbench optimized explicitly for high-context SaaS and agency disputes, giving you full control over the final packet.',
    featureComparison: [
      { feature: 'Pricing Model', competitor: 'Percentage Success Fee', verdact: 'Your choice (free in beta)' },
      { feature: 'Target Audience', competitor: 'Enterprise / E-com', verdact: 'B2B SaaS / Services' },
      { feature: 'Evidence Workbench', competitor: 'Black box', verdact: 'Guided 3-stage UI' },
      { feature: 'Filing Workflow', competitor: 'Autopilot', verdact: 'Strict Approval Lock' },
      { feature: 'Comms Ingestion', competitor: 'No', verdact: 'Yes (Slack import; email via upload)' },
      { feature: 'VAMP Monitor', competitor: 'No', verdact: 'Stripe 0.75% Line Alert' }
    ]
  },
  {
    slug: 'chargebacks911',
    name: 'Chargebacks911',
    pricingModel: 'Enterprise contracts ($1,000+/mo minimums)',
    filingPosture: 'Fully managed service',
    integrations: ['Universal (Agnostic)'],
    keyVulnerability: 'Chargebacks911 is priced and built for massive, high-volume retailers. The cost is highly prohibitive for SaaS startups and digital agencies.',
    verdactAdvantage: 'Verdact democratizes enterprise-grade dispute defense for startups, with deep, native Stripe Connect integration and no enterprise sales process.',
    featureComparison: [
      { feature: 'Pricing Model', competitor: 'Enterprise Contracts', verdact: 'Your choice (free in beta)' },
      { feature: 'Target Audience', competitor: 'Enterprise Retail', verdact: 'SaaS / Agencies' },
      { feature: 'Filing Workflow', competitor: 'Managed Service', verdact: 'Self-Serve + Approval Lock' },
      { feature: 'Setup Time', competitor: 'Weeks (Sales calls)', verdact: 'Minutes (Stripe Connect)' },
      { feature: 'VAMP Monitor', competitor: 'Yes', verdact: 'Stripe 0.75% Line Alert' },
      { feature: 'Stripe API Native', competitor: 'Yes', verdact: 'Yes' }
    ]
  },
  {
    slug: 'chargepay',
    name: 'ChargePay',
    pricingModel: '$19.99/mo flat OR 20% success fee (merchant’s choice)',
    filingPosture: 'Automated templates via Stripe App',
    integrations: ['Stripe'],
    keyVulnerability: 'Because it relies on the constrained Stripe App framework, it uses generic response templates that lack the depth and multi-layer proof needed for high-value B2B disputes.',
    verdactAdvantage: 'Verdact is a standalone platform that lets you import Slack sign-offs directly and add email correspondence into your evidence packet to help prove customer acceptance.',
    featureComparison: [
      { feature: 'Pricing Model', competitor: 'Monthly OR Success Fee', verdact: 'Your choice (free in beta)' },
      { feature: 'Platform Type', competitor: 'Stripe App Frame', verdact: 'Standalone Generative UI' },
      { feature: 'Filing Workflow', competitor: 'Template Autopilot', verdact: 'Strict Approval Lock' },
      { feature: 'Comms Ingestion', competitor: 'No', verdact: 'Yes (Slack import; email via upload)' },
      { feature: 'VAMP Monitor', competitor: 'No', verdact: 'Stripe 0.75% Line Alert' },
      { feature: 'Stripe API Native', competitor: 'Yes', verdact: 'Yes' }
    ]
  },
  {
    slug: 'disputeninja',
    name: 'DisputeNinja',
    pricingModel: 'Acquired by Whop (Not available standalone)',
    filingPosture: 'Legacy automated template generator',
    integrations: ['Stripe'],
    keyVulnerability: 'DisputeNinja was acquired and its technology absorbed, leaving legacy users without a dedicated, standalone chargeback platform focused on independent SaaS.',
    verdactAdvantage: 'Verdact is an independent, dedicated platform built from the ground up to offer state-of-the-art evidence generation specifically for SaaS and service businesses.',
    featureComparison: [
      { feature: 'Pricing Model', competitor: 'N/A (Acquired)', verdact: 'Your choice (free in beta)' },
      { feature: 'Platform Status', competitor: 'Absorbed into Whop', verdact: 'Independent Platform' },
      { feature: 'Filing Workflow', competitor: 'Legacy Templates', verdact: 'Strict Approval Lock' },
      { feature: 'Comms Ingestion', competitor: 'No', verdact: 'Yes (Slack import; email via upload)' },
      { feature: 'VAMP Monitor', competitor: 'No', verdact: 'Stripe 0.75% Line Alert' },
      { feature: 'Stripe API Native', competitor: 'Yes', verdact: 'Yes' }
    ]
  },
  {
    slug: 'byedispute',
    name: 'ByeDispute',
    pricingModel: 'Monthly SaaS fee (pricing not publicly disclosed)',
    filingPosture: 'Prevention alerts only (Refund before dispute)',
    integrations: ['Stripe'],
    keyVulnerability: 'ByeDispute is primarily an early-warning alert system designed to help you refund transactions before they become disputes. It does not help you fight and win chargebacks if you choose to stand your ground.',
    verdactAdvantage: 'Verdact provides robust defense mechanics. If you delivered the service and want to fight the dispute, Verdact helps you assemble the Compelling Evidence 3.0-aligned packet you need for your case.',
    featureComparison: [
      { feature: 'Pricing Model', competitor: 'Monthly Fee (undisclosed)', verdact: 'Your choice (free in beta)' },
      { feature: 'Primary Function', competitor: 'Early-Warning Alerts', verdact: 'Dispute Defense & Recovery' },
      { feature: 'Evidence Workbench', competitor: 'No', verdact: 'Guided 3-stage UI' },
      { feature: 'Filing Workflow', competitor: 'N/A', verdact: 'Strict Approval Lock' },
      { feature: 'VAMP Monitor', competitor: 'No', verdact: 'Stripe 0.75% Line Alert' },
      { feature: 'Stripe API Native', competitor: 'Yes', verdact: 'Yes' }
    ]
  }
];

export function getCompetitorDetail(slug: string): competitorDetail | undefined {
  const normSlug = slug.toLowerCase().trim();
  return COMPETITOR_DETAILS.find((c) => c.slug === normSlug);
}
