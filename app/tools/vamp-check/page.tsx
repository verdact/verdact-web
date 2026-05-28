import type { Metadata } from 'next';
import { VampChecker } from './VampChecker';

export const metadata: Metadata = {
  title: 'VAMP Risk Checker',
  description:
    'Estimate your Visa VAMP ratio and see how far you are from the 1.5% enforcement threshold. Free tool for Stripe SaaS and service merchants.',
};

export default function VampCheckPage() {
  return <VampChecker />;
}
