import { VibeProvider } from '@/state/VibeProvider';
import { ToastProvider } from '@/state/ToastProvider';
import { PlayerProvider } from '@/state/PlayerProvider';
import { AppShell } from '@/components/AppShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <VibeProvider>
        <ToastProvider>
          <PlayerProvider>
            <AppShell />
          </PlayerProvider>
        </ToastProvider>
      </VibeProvider>
    </ErrorBoundary>
  );
}
