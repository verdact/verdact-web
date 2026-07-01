export interface ReasonCodeDetail {
  network: 'visa' | 'mastercard' | 'amex' | 'network';
  code: string;
  category: string;
  title: string;
  description: string;
  winStrategy: string;
  requiredEvidence: string[];
}

export const REASON_CODE_DETAILS: ReasonCodeDetail[] = [
  {
    network: 'visa',
    code: '13-1',
    category: 'product_not_received',
    title: 'Visa 13.1: Services Not Received',
    description: 'This is the most common reason code for B2B SaaS and agency chargebacks. It is triggered when the cardholder claims they paid for a service, but the merchant failed to deliver the service, or the service was not rendered by the agreed-upon date.',
    winStrategy: 'To win a Visa 13.1 dispute for services, you must prove three things (the Chain of Intent): first, that the client agreed to a specific scope of work (contract/proposal); second, that the work was delivered (deliverables, files, or reports sent); and third, that the client acknowledged and accepted the delivery (email confirmation, sign-off, or Slack approvals). Traditional auto-evidence generators that only submit raw Stripe invoices will fail this code.',
    requiredEvidence: [
      'Signed agreement, proposal, or contract showing the scope of services.',
      'Contemporaneous emails or Slack message transcripts where the client approves the work.',
      'Detailed timestamps showing deliverables completed and sent to the client.',
      'SaaS usage history or platform activity logs verifying active account actions post-purchase.'
    ]
  },
  {
    network: 'visa',
    code: '13-2',
    category: 'subscription_canceled',
    title: 'Visa 13.2: Cancelled or Unresolved Recurring Transaction',
    description: 'This code applies when a cardholder claims they cancelled their subscription or recurring billing service, but the merchant continued to charge their card without authorization.',
    winStrategy: 'To defend against a Visa 13.2 subscription cancellation dispute, you must provide the cancellation policy the customer accepted at checkout, prove they agreed to it (e.g. ticked a checkbox), and show that they either did not cancel before the charge or that they accessed and used the service after the billing event.',
    requiredEvidence: [
      'A copy of your refund and cancellation policy as it was visible at the time of signup.',
      'Checkout log proving the customer checked a box agreeing to recurring billing terms.',
      'Platform log showing active logins or usage of the SaaS after the claimed cancellation date.',
      'Communications showing the customer did not request cancellation or acknowledged the billing period.'
    ]
  },
  {
    network: 'visa',
    code: '13-3',
    category: 'product_unacceptable',
    title: 'Visa 13.3: Not as Described or Defective',
    description: 'This code is used when the customer claims the service they received was completely different from what was agreed upon, or did not match the quality promised.',
    winStrategy: 'Winning Visa 13.3 requires proving that the deliverables matched the agreed-upon contract specifications. Show the client approved interim milestones and accepted the final outcome, proving that they are raising the dispute as an afterthought to avoid payment.',
    requiredEvidence: [
      'Detailed contract or Statement of Work (SOW) outlining deliverables.',
      'Milestone acceptance records or written sign-off confirming work met requirements.',
      'Review records, meeting minutes, or emails showing feedback loops and satisfaction.',
      'Activity reports showing they used the deliverables in their business operations.'
    ]
  },
  {
    network: 'visa',
    code: '10-4',
    category: 'fraudulent',
    title: 'Visa 10.4: Card-Absent Fraud',
    description: 'This dispute code is raised when the cardholder claims they did not authorize the transaction and their card was used fraudulently online.',
    winStrategy: 'Under the Visa Compelling Evidence 3.0 (CE 3.0) rules, fraudulent disputes can be won by providing historical evidence of transactions. You must prove the card was used by the same customer for prior, undisputed transactions at least 120 days ago, using matching device fingerprints, IP addresses, or shipping addresses.',
    requiredEvidence: [
      'IP address and device fingerprint of the disputed transaction.',
      'Device/IP fingerprints matching at least two prior undisputed transactions at least 120 days old.',
      'Matching customer name, billing address, and email across historical transactions.',
      'Platform usage data establishing standard customer footprint.'
    ]
  },
  {
    network: 'mastercard',
    code: '4853',
    category: 'product_not_received',
    title: 'Mastercard 4853: Services Not Provided',
    description: 'Mastercard equivalent of Visa 13.1. It is raised when the cardholder claims the merchant did not perform the services or failed to make the platform available.',
    winStrategy: 'Provide a structured evidence packet showing deliverables were fully rendered. In B2B SaaS, this is supported by usage logs and setup activity. In agencies/consulting, this is supported by completed project boards, source code repositories, or design link deliverables.',
    requiredEvidence: [
      'Detailed deliverables checklist indicating completion dates.',
      'Usage/activity records indicating client was actively utilizing the platform.',
      'Contemporaneous correspondence confirming the client was satisfied with the progress.',
      'A copy of the terms of service accepted at checkout.'
    ]
  },
  {
    network: 'mastercard',
    code: '4837',
    category: 'fraudulent',
    title: 'Mastercard 4837: Card-Absent Fraud',
    description: 'Mastercard code for unauthorized online transactions. The cardholder claims they have no knowledge of the purchase.',
    winStrategy: 'Submit evidence that the account owner actively initialized and utilized the service. While Mastercard does not have the exact Visa CE 3.0 120-day rules, providing a transaction log showing matching IP addresses, email communication, and client profile detail will help issuers reject friendly fraud.',
    requiredEvidence: [
      'Detailed checkout logs with billing country matching IP location.',
      'Profile information showing domain ownership (e.g. company email matched to business domain).',
      'Platform usage logs showing activity and profile setup.',
      'Prior payment history or interactions.'
    ]
  },
  {
    network: 'visa',
    code: '12-6',
    category: 'duplicate',
    title: 'Visa 12.6: Duplicate Processing',
    description: 'This code is used when a cardholder claims a single transaction was processed more than once, resulting in multiple charges for the same service or product.',
    winStrategy: 'To win a duplicate processing dispute, you must prove that the two charges were for two separate and distinct services, subscriptions, or products, OR that one of the charges was already refunded.',
    requiredEvidence: [
      'Two separate invoices or receipts showing different items or subscription periods.',
      'Server logs showing two distinct checkout sessions or upgrade paths.',
      'Proof that a refund was already issued for one of the transactions.',
      'Communication from the customer requesting the second distinct charge.'
    ]
  },
  {
    network: 'visa',
    code: '13-6',
    category: 'credit_not_processed',
    title: 'Visa 13.6: Credit Not Processed',
    description: 'Triggered when a cardholder claims they cancelled a service or returned a product, and the merchant agreed to a refund but never processed it.',
    winStrategy: 'You must prove either that the refund was actually processed (and provide the Acquirer Reference Number / ARN), or that the customer was never entitled to a refund based on the cancellation policy they agreed to at checkout.',
    requiredEvidence: [
      'The strict no-refund or cancellation policy agreed to at checkout.',
      'Evidence the customer did not meet the conditions for a refund.',
      'If refunded, the ARN or proof of credit issued to the cardholder.',
      'Communication transcripts refusing the refund based on policy.'
    ]
  },
  {
    network: 'mastercard',
    code: '4834',
    category: 'point_of_interaction_error',
    title: 'Mastercard 4834: Point of Interaction Error',
    description: 'This broad Mastercard code covers situations where the cardholder claims they were charged the wrong amount or charged multiple times for the same transaction (paid twice via different or the same payment form).',
    winStrategy: 'Your defense depends on the specific claim. For duplicate charges, prove the two charges were for distinct purchases (or that one was already refunded). For wrong amounts, prove the customer agreed to the final billed amount. For canceled-subscription billing claims, use Mastercard 4853 instead: that is the correct code for recurring-transaction disputes.',
    requiredEvidence: [
      'Checkout log showing the exact amount the customer authorized.',
      'Cancellation policy and proof the customer did not cancel in time.',
      'Invoices detailing separate charges if a duplicate is claimed.',
      'Usage logs showing the customer consumed the service.'
    ]
  },
  {
    network: 'amex',
    code: '13-1',
    category: 'product_not_received',
    title: 'Amex Services Not Received',
    description: 'American Express code for disputes where services were not rendered. Amex reviewer standards are notoriously high and require clean documentation.',
    winStrategy: 'Amex requires clear proof of delivery. A standard response should include the signed agreement, deliverables timestamps, and clear client confirmation that the work was accepted.',
    requiredEvidence: [
      'Signed agreement detailing delivery timeline and refund constraints.',
      'Client confirmation email acknowledging the project is complete.',
      'Usage or delivery records showing client accessed files or software.',
      'Terms and conditions showing the service scope.'
    ]
  }
];

export function getDetailsForCode(network: string, code: string): ReasonCodeDetail | undefined {
  const normNetwork = network.toLowerCase().trim();
  const normCode = code.toLowerCase().trim().replace('_', '-');
  return REASON_CODE_DETAILS.find(
    (d) => d.network === normNetwork && d.code.replace('.', '-') === normCode
  );
}
