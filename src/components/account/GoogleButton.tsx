import { useEffect, useRef, useState } from 'react';
import { renderGoogleButton } from '@/sync/google';

/**
 * Google's own "Continue with Google" button (src/sync/google.ts draws it, in
 * an iframe of Google's). Its script loads only when this is on screen.
 * Used by the Account panel and by the assistant sign-in page (/authorize).
 */
export function GoogleButton({
  clientId,
  onCredential,
  className,
}: {
  clientId: string;
  onCredential: (credential: string) => void;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const callback = useRef(onCredential);
  callback.current = onCredential;
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    void renderGoogleButton(element, clientId, (credential) => callback.current(credential)).then((ok) => setFailed(!ok));
  }, [clientId]);
  if (failed) {
    return <p className="text-sm text-muted">Couldn’t reach Google — check your connection, or an ad blocker.</p>;
  }
  return <div ref={host} className={className ?? 'flex min-h-10 justify-center'} />;
}
