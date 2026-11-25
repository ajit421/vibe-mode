import { useState } from 'react';
import type { Account } from '@/sync/sync';
import { cn } from '@/utils/cn';

/**
 * The signed-in account's face: their Google picture, or their initial on the
 * mode's colour when there is none (or it fails to load). The picture URL is
 * checked to be Google's own (safeAccount in src/sync/sync.ts) before it gets here.
 */
export function Avatar({ account, className }: { account: Account; className?: string }) {
  const [broken, setBroken] = useState(false);
  const initial = (account.name ?? account.email ?? '?').trim().charAt(0).toUpperCase() || '?';
  if (account.picture && !broken) {
    return (
      <img
        src={account.picture}
        alt=""
        // Google's image host refuses some requests that carry a Referer.
        referrerPolicy="no-referrer"
        className={cn('rounded-full object-cover', className)}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-primary font-display font-semibold text-canvas',
        className,
      )}
    >
      {initial}
    </span>
  );
}
