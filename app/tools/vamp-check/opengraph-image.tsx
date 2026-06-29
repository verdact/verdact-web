import { verdactOgCard } from '@/lib/og/card';

export const alt = 'Free Stripe dispute-rate and VAMP risk check';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return verdactOgCard({
    eyebrow: 'Free VAMP · dispute-rate check',
    title: 'How close is your Stripe account to the 0.75% line?',
    sub: 'Estimate your dispute rate across every card brand and see your real headroom before Stripe can act. No login.',
  });
}
