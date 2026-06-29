import { verdactOgCard } from '@/lib/og/card';

export const alt = 'Verdact: win the Stripe disputes everyone else marks unwinnable';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return verdactOgCard({
    eyebrow: 'Stripe dispute defense',
    title: 'Win the Stripe disputes everyone else marks unwinnable.',
    sub: 'Build submission-ready evidence for high-context SaaS and service disputes. Free during beta.',
  });
}
