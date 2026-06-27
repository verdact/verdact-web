/**
 * Glossary — the single source of truth for plain-English term definitions
 * surfaced by <GlossaryTerm>. Keyed by a stable term id.
 *
 * Each entry has:
 *   label      — the human label shown inline (plain English first).
 *   plain      — a one-line gloss for tooltips / dense spots.
 *   definition — the fuller, popover-length explanation.
 *
 * S41-safe: definitions describe what a thing IS and how Verdact treats it.
 * They make NO promises, guarantees, or win-rate claims, and never imply a
 * particular outcome. Keep them plain; no jargon-defining-jargon.
 */
export interface GlossaryEntry {
  label: string;
  plain: string;
  definition: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  vamp: {
    label: 'VAMP',
    plain: "Visa's program that watches a merchant's dispute levels.",
    definition:
      "VAMP is Visa's Acquirer Monitoring Program. It tracks how many disputes a business gets relative to its sales. If that ratio climbs past Visa's thresholds, the business can face extra monitoring and fees. Verdact shows where you stand against those lines so nothing comes as a surprise.",
  },
  ce3: {
    label: 'CE3.0',
    plain: 'A Visa rule for reusing proof from a past undisputed order.',
    definition:
      'CE3.0 (Compelling Evidence 3.0) is a Visa rule for certain fraud disputes. It lets a business point to earlier, undisputed orders from the same cardholder, using matching details like device or address, to show a prior relationship. Verdact flags when a case may fit this pattern so you can decide whether to use it.',
  },
  dispute_rate: {
    label: 'dispute rate',
    plain: 'Your disputes measured against your sales.',
    definition:
      'Your dispute rate is the share of your transactions that turn into disputes over a period. Card networks watch this number, so Verdact tracks it for you and shows it next to the network thresholds, in plain terms.',
  },
  comms: {
    label: 'messages',
    plain: 'Emails and chats with the customer about the order.',
    definition:
      'Messages are the back-and-forth with the customer about an order: emails, support chats, or order notes. When they show the customer was helped or agreed to terms, they can become evidence. Verdact gathers them so you can see what is on the record for a case.',
  },
  policy: {
    label: 'policy',
    plain: 'Your store rules the customer agreed to.',
    definition:
      'A policy is a store rule the customer accepted at checkout, such as a refund or shipping policy. When a dispute pushes back on something the customer already agreed to, the policy can support your side. Verdact keeps the accepted version on file with the case.',
  },
  delivery: {
    label: 'delivery proof',
    plain: 'Evidence the order reached the customer.',
    definition:
      'Delivery proof shows that an order arrived: tracking, a carrier scan, a signature, or an access log for digital goods. It answers the common "I never got it" dispute. Verdact lines this proof up with the case so you can see what is present and what is missing.',
  },
  acceptance_proof: {
    label: 'acceptance proof',
    plain: 'A record that the customer agreed to your terms.',
    definition:
      'Acceptance proof is a record that the customer agreed to your terms, such as a checked box at checkout or a timestamp on a terms page. It supports cases that hinge on what the customer signed up for. Verdact stores it alongside the order it belongs to.',
  },
  chargeback: {
    label: 'chargeback',
    plain: 'A customer asks their bank to reverse a charge.',
    definition:
      'A chargeback is when a customer asks their bank to reverse a charge instead of contacting the business first. The business can respond with evidence. Verdact helps you organize that response and decide, on your own timeline, whether to send it.',
  },
};

/** Safe lookup; returns null for an unknown term id. */
export function getGlossaryEntry(term: string): GlossaryEntry | null {
  return GLOSSARY[term] ?? null;
}
