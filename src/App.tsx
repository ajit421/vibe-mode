import { LazyMotion, domAnimation } from 'motion/react';
import { VibeProvider } from '@/state/VibeProvider';
import { ToastProvider } from '@/state/ToastProvider';
import { PlayerProvider } from '@/state/PlayerProvider';
import { SyncProvider } from '@/state/SyncProvider';
import { AppShell } from '@/components/AppShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function App() {
  return (
    // `m.*` + `domAnimation` instead of `motion.*`: ships only the fade/slide/
    // hover features this app uses, roughly halving the animation bundle. Nothing
    // uses `layout` or `drag`; if something ever needs them, switch to `domMax`.
    // `strict` makes a stray `motion.*` throw in dev instead of silently
    // pulling the full bundle back in.
    <LazyMotion features={domAnimation} strict>
      <ErrorBoundary>
        <VibeProvider>
          <ToastProvider>
            {/* Saves the listener's changes to the cloud; needs both providers above. */}
            <SyncProvider>
              <PlayerProvider>
                <AppShell />
              </PlayerProvider>
            </SyncProvider>
          </ToastProvider>
        </VibeProvider>
      </ErrorBoundary>
    </LazyMotion>
  );
}
