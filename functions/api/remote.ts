import { fail, json, readText, signedIn, type Handler } from '../../server/lib';

// A tab with "Let AI control this tab" on polls here every few seconds
// (src/components/RemoteControl.tsx). It sends what it is playing when that
// changed, and gets back the commands an assistant queued through the MCP
// server, plus the profile's version so it can pick up edits to modes.
//
// Writes are kept rare: state only when it changed, and the "still here"
// time at most every 20 seconds — a listening tab costs requests, not writes.

const STATE_LIMIT = 4_000;
const SEEN_EVERY_MS = 20_000;
const COMMAND_TTL_MS = 120_000;

export const onRequestPost: Handler = async ({ env, request }) => {
  // AI control of a tab is a signed-in feature, like everything cloud.
  const who = await signedIn(env, request);
  if (who instanceof Response) return who;
  const text = await readText(request, STATE_LIMIT);
  if (text === null) return fail(413, 'Too large.');
  let state: unknown;
  try {
    state = (JSON.parse(text || '{}') as { state?: unknown }).state;
  } catch {
    return fail(400, 'Not JSON.');
  }

  const now = Date.now();
  const id = who.profileId;
  const [, , taken, profile] = await env.DB.batch([
    state !== undefined
      ? env.DB.prepare(
          `INSERT INTO remote_state (profile_id, state, seen_at) VALUES (?, ?, ?)
           ON CONFLICT (profile_id) DO UPDATE SET state = excluded.state, seen_at = excluded.seen_at`,
        ).bind(id, JSON.stringify(state), now)
      : env.DB.prepare('UPDATE remote_state SET seen_at = ? WHERE profile_id = ? AND seen_at < ?').bind(now, id, now - SEEN_EVERY_MS),
    env.DB.prepare('DELETE FROM remote_commands WHERE profile_id = ? AND created_at < ?').bind(id, now - COMMAND_TTL_MS),
    env.DB.prepare('DELETE FROM remote_commands WHERE profile_id = ? RETURNING id, action, value').bind(id),
    env.DB.prepare('SELECT version FROM profiles WHERE id = ?').bind(id),
  ]);

  const commands = (taken.results as { id: number; action: string; value: string | null }[])
    .sort((a, b) => a.id - b.id)
    .map(({ action, value }) => ({ action, value }));
  const version = (profile.results[0] as { version?: number } | undefined)?.version ?? null;
  return json({ commands, version });
};
