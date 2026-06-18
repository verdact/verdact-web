import 'server-only';

// Public surface of the email module. Callers should import the intent-named
// send functions; the low-level client and templates stay internal but are
// re-exported for tests and advanced callers.
export {
  sendAuditRecapEmail,
  sendWaitlistConfirmationEmail,
  sendDeletionAckEmail,
} from './send';
export {
  sendEmail,
  emailFrom,
  isEmailEnabled,
  type EmailSendResult,
  type EmailMessage,
} from './client';
export {
  auditRecapEmail,
  waitlistConfirmationEmail,
  deletionAckEmail,
  type EmailBody,
  type AuditRecapInput,
} from './templates';
