import { ListMusic, TriangleAlert } from 'lucide-react';
import { useVibe } from '@/state/vibe-context';
import { resolvePlaylistSource } from '@/music/resolve';
import { cn } from '@/utils/cn';

interface PlaylistChipsProps {
  /** `bar` is the compact row inside the expanded player. */
  variant?: 'hero' | 'bar';
}

/**
 * Switches between the playlists a mode offers. Playlists that have no
 * YouTube ID yet are still shown — greyed, with a warning — rather than
 * hidden, so it is obvious what is left to configure.
 */
export function PlaylistChips({ variant = 'hero' }: PlaylistChipsProps) {
  const { theme, playlistId, selectPlaylist, playlistOverrides } = useVibe();

  if (theme.playlists.length === 0) {
    return (
      <p className="font-mono text-xs text-muted">
        No playlists configured for this mode yet — see src/music/playlists.ts
      </p>
    );
  }

  return (
    <div
      className={cn('flex flex-wrap gap-2', variant === 'bar' && 'gap-1.5')}
      role="group"
      aria-label={`Playlists for ${theme.name}`}
    >
      {theme.playlists.map((playlist) => {
        const selected = playlist.id === playlistId;
        const configured = resolvePlaylistSource(playlist, playlistOverrides[playlist.id]) !== null;

        return (
          <button
            key={playlist.id}
            type="button"
            onClick={() => selectPlaylist(playlist.id)}
            aria-pressed={selected}
            title={configured ? playlist.description : `${playlist.name} — no playlist ID set yet`}
            className={cn(
              'group inline-flex items-center gap-2 rounded-full border transition-all duration-200',
              variant === 'hero' ? 'px-3.5 py-2 text-sm' : 'px-3 py-1.5 text-xs',
              selected
                ? 'border-primary/60 bg-primary/14 text-ink shadow-sm shadow-glow/20'
                : 'border-line text-muted hover:border-primary/40 hover:text-ink',
            )}
          >
            {configured ? (
              <ListMusic
                className={cn('size-3.5 shrink-0', selected ? 'text-primary' : 'text-muted')}
              />
            ) : (
              <TriangleAlert className="size-3.5 shrink-0 text-primary/70" />
            )}
            <span className="font-medium">{playlist.name}</span>
            {playlist.mood && variant === 'hero' && (
              <span className="vm-label rounded-full bg-ink/8 px-1.5 py-0.5 text-[0.6rem] text-muted">
                {playlist.mood}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
