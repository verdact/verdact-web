'use client';

import s from '../account-health.module.css';

// Honest "export" with no backend dependency: the browser prints the current
// account-health read to PDF. Real artifact the merchant can keep; nothing is
// sent anywhere. Paid-gated affordance, open to everyone during beta.
export function ExportButton() {
  return (
    <button type="button" className={s.exportBtn} onClick={() => window.print()}>
      Export report
    </button>
  );
}
