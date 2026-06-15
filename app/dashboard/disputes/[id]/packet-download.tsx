'use client';

/**
 * Client-side download of the assembled packet as a plain-text file (honest, no
 * third-party PDF — the locked submission channel is Stripe native fields). The
 * server serializes the packet and passes the text in; this only triggers the
 * browser download. Rendered inside <PaidGate>, so it is only reachable when the
 * action is allowed (beta = unlocked).
 */
export function PacketDownloadButton({
  text,
  filename,
  label,
}: {
  text: string;
  filename: string;
  label: string;
}) {
  const onClick = () => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 rounded-md bg-action px-4 py-2 text-sm font-semibold text-white hover:bg-action-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/40"
      onClick={onClick}
    >
      {label}
    </button>
  );
}
