// Source-of-truth dispute-rate lines, shared by the authed Account Health view
// (server) and the public VAMP checker (client). Plain module with no runtime
// dependencies so both server and client components can import it. Values are
// percents (e.g. 0.75 = 0.75%); fraction-based callers divide by 100.
//
// Bands keyed off these lines, identical across both surfaces:
//   under HEALTHY_LINE      → healthy
//   HEALTHY_LINE..STRIPE_LINE → getting close
//   at/above STRIPE_LINE    → over the line / at risk

export const SCORE_FLOOR = 50; // monthly settled charges below which a single event is noise
export const HEALTHY_LINE = 0.65; // under this = healthy ("under about 0.65% is normal")
export const STRIPE_LINE = 0.75; // Stripe acts here; the operative line for most merchants
export const GAUGE_MAX = 1.5; // gauge right edge = Visa's excessive ratio
