import { verdactOgCard } from '@/lib/og/card';

export const alt = 'Free Stripe dispute audit — find the disputes you should have won';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return verdactOgCard({
    eyebrow: 'Free dispute audit · no login',
    title: 'Find the Stripe disputes you should have won.',
    sub: 'See which were winnable, where your dispute rate stands against the 0.75% line, and how many hinged on comms evidence Stripe cannot reach.',
  });
}
