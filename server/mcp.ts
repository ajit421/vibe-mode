import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { normaliseSource } from '../src/music/resolve';
import { safeImageUrl } from '../src/themes/backgrounds';
import { DATA_LIMIT, hashKey, profileForKey, type Env } from './lib';
import {
  BUILT_IN_MODES,
  COLOR_KEYS,
  PREFERENCE_KEYS,
  ToolError,
  addMode,
  addPlaylist,
  asVibeData,
  overview,
  removeMode,
  restoreMode,
  setPreferences,
  updateMode,
  updatePlaylist,
  type VibeData,
} from './vibe';

/*
 * The Vibe Mode MCP server: tools an AI assistant (Claude, ChatGPT, Gemini…)
 * calls to change Vibe Mode for the person who connected it. Built fresh for
 * every request (stateless Streamable HTTP, see functions/mcp/[[path]].ts).
 *
 * Who is calling decides the tools:
 *  - a device key (the visitor's MCP link) → their own modes, playlists,
 *    preferences, and the player in a tab they've let the AI control;
 *  - the owner key (MCP_ADMIN_TOKEN) → the site's defaults for everyone.
 */

export type Access = { kind: 'visitor'; profileId: string } | { kind: 'owner' };

/** Who an MCP link belongs to, or null. The owner key is compared in constant time. */
export async function accessFor(env: Env, secret: string): Promise<Access | null> {
  const owner = env.MCP_ADMIN_TOKEN;
  if (owner && owner.length >= 32) {
    // Equal-length digests compared without an early exit, so timing says nothing.
    const [a, b] = await Promise.all([hashKey(secret), hashKey(owner)]);
    let diff = 0;
    for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    if (diff === 0) return { kind: 'owner' };
  }
  const who = await profileForKey(env, secret);
  return who ? { kind: 'visitor', profileId: who.profileId } : null;
}

/** A tab counts as listening if it polled within this long (it polls every 4s, reports every 20s). */
const LISTENING_MS = 45_000;
const COMMAND_TTL_MS = 120_000;

const reply = (text: string, data?: unknown) => ({
  content: [{ type: 'text' as const, text: data === undefined ? text : `${text}\n\n${JSON.stringify(data, null, 2)}` }],
});
const problem = (text: string) => ({ isError: true, content: [{ type: 'text' as const, text }] });

/** Runs a tool, turning a `ToolError` into an answer the assistant can act on. */
const guard =
  <A,>(run: (args: A) => Promise<ReturnType<typeof reply>>) =>
  async (args: A) => {
    try {
      return await run(args);
    } catch (error) {
      if (error instanceof ToolError) return problem(error.message);
      throw error;
    }
  };

const modeId = z.string().describe('A mode id, as listed by get_my_vibe (e.g. "metro", "my-ab12cd34").');

export function buildServer(env: Env, access: Access): McpServer {
  const server = new McpServer(
    { name: 'vibe-mode', version: '1.0.0' },
    {
      instructions:
        access.kind === 'owner'
          ? 'Owner access to Vibe Mode (vibe-mode.pages.dev): change the default playlists, backgrounds and posters every visitor sees.'
          : 'Vibe Mode (vibe-mode.pages.dev) turns the site into a place — metro, train, office… — with its own look and YouTube playlists. ' +
            'Call get_my_vibe first. Changes to modes reach the person’s open tab when they return to it or reload. ' +
            'The player tools need a tab with "Let AI control this tab" switched on.',
    },
  );
  if (access.kind === 'owner') registerOwnerTools(server, env);
  else registerVisitorTools(server, env, access.profileId);
  return server;
}

function registerVisitorTools(server: McpServer, env: Env, profileId: string) {
  const load = async (): Promise<VibeData> => {
    const row = await env.DB.prepare('SELECT data FROM profiles WHERE id = ?').bind(profileId).first<{ data: string }>();
    if (!row) throw new ToolError('This person’s cloud save is gone (deleted or signed out). Make a new MCP link in Customize.');
    return asVibeData(JSON.parse(row.data));
  };
  /** Load, change, save. A new version makes the open tab pick the change up. */
  // shortcut: read-modify-write without a lock; two tool calls in the same instant can lose one. Add a version check if assistants start running tools in parallel.
  const change = async <T,>(edit: (data: VibeData) => T): Promise<T> => {
    const data = await load();
    const result = edit(data);
    const json = JSON.stringify(data);
    if (json.length > DATA_LIMIT) throw new ToolError('That would make the saved data too large.');
    await env.DB.prepare('UPDATE profiles SET data = ?, version = ? WHERE id = ?').bind(json, Date.now(), profileId).run();
    return result;
  };
  const dropUpload = (mode: string) =>
    env.DB.prepare('DELETE FROM uploads WHERE profile_id = ? AND mode_id = ?').bind(profileId, mode).run();

  server.registerTool(
    'get_my_vibe',
    {
      title: 'Get my modes and playlists',
      description: 'Every mode (built-in and the person’s own), with names, visibility, pictures and playlists, plus preferences.',
      annotations: { readOnlyHint: true },
    },
    guard(async () => reply('Current Vibe Mode setup:', overview(await load()))),
  );

  server.registerTool(
    'update_mode',
    {
      title: 'Change a mode',
      description: 'Rename a mode, change its status line, description, quotes, colours or picture, or hide/show it. Only the fields given change.',
      inputSchema: {
        mode: modeId,
        name: z.string().max(40).optional(),
        shortName: z.string().max(18).optional().describe('Short name for the top bar.'),
        statusLine: z.string().max(48).optional().describe('The small line above the name.'),
        description: z.string().max(140).optional(),
        quotes: z.array(z.string().max(200)).max(40).optional().describe('Replaces all quotes.'),
        colors: z
          // partialRecord: zod 4's `record` with enum keys demands every key.
          .partialRecord(z.enum(COLOR_KEYS), z.string().regex(/^#[0-9a-fA-F]{6}$/))
          .optional()
          .describe('Any of: ' + COLOR_KEYS.join(', ') + ' as "#rrggbb".'),
        hidden: z.boolean().optional().describe('Hide from (or show in) the mode picker.'),
        picture: z.string().optional().describe('An https:// image or video link, "none" for a colour gradient, or "default".'),
      },
    },
    guard(async ({ mode, ...patch }) => {
      const { dropUpload: drop } = await change((data) => updateMode(data, mode, patch));
      if (drop) await dropUpload(mode);
      return reply(`Updated ${mode}.`);
    }),
  );

  server.registerTool(
    'add_mode',
    {
      title: 'Add a mode',
      description: 'Make a new mode as a copy of an existing one (its look and playlists), then change it with update_mode.',
      inputSchema: { copyOf: modeId, name: z.string().max(40).optional() },
    },
    guard(async ({ copyOf, name }) => {
      const id = await change((data) => addMode(data, copyOf, name));
      return reply(`Added mode ${id}.`, { id });
    }),
  );

  server.registerTool(
    'remove_mode',
    {
      title: 'Remove a mode',
      description: 'Built-in modes go to the bin (restore_mode brings them back); the person’s own modes are deleted.',
      inputSchema: { mode: modeId },
      annotations: { destructiveHint: true },
    },
    guard(async ({ mode }) => {
      const how = await change((data) => removeMode(data, mode));
      if (how === 'removed') await dropUpload(mode);
      return reply(how === 'binned' ? `${mode} is in the bin; restore_mode brings it back.` : `${mode} was deleted.`);
    }),
  );

  server.registerTool(
    'restore_mode',
    {
      title: 'Restore a mode',
      description: 'Bring back a built-in mode from the bin, and show it in the picker.',
      inputSchema: { mode: modeId },
    },
    guard(async ({ mode }) => {
      await change((data) => restoreMode(data, mode));
      return reply(`${mode} is back.`);
    }),
  );

  server.registerTool(
    'add_playlist',
    {
      title: 'Add a playlist',
      description: 'Add a YouTube playlist (or one or more videos, comma-separated) to a mode.',
      inputSchema: {
        mode: modeId,
        name: z.string().max(60),
        link: z.string().describe('A YouTube playlist link or id, or video links/ids separated by commas.'),
      },
    },
    guard(async ({ mode, name, link }) => {
      const id = await change((data) => addPlaylist(data, mode, name, link));
      return reply(`Added playlist ${id} to ${mode}.`, { id });
    }),
  );

  server.registerTool(
    'update_playlist',
    {
      title: 'Change or remove a playlist',
      description: 'Rename, relink or remove a playlist in a mode. An empty link sends a built-in playlist back to the site’s default.',
      inputSchema: {
        mode: modeId,
        playlist: z.string().describe('Playlist id from get_my_vibe.'),
        name: z.string().max(60).optional(),
        link: z.string().optional(),
        remove: z.boolean().optional(),
      },
      annotations: { destructiveHint: true },
    },
    guard(async ({ mode, playlist, ...patch }) => {
      await change((data) => updatePlaylist(data, mode, playlist, patch));
      return reply(patch.remove ? `Removed ${playlist} from ${mode}.` : `Updated ${playlist}.`);
    }),
  );

  server.registerTool(
    'set_preferences',
    {
      title: 'Change preferences',
      description: 'Turn site preferences on or off: motion (animations), ambient (atmosphere layers), clock, hud (status readouts), quotes.',
      inputSchema: Object.fromEntries(PREFERENCE_KEYS.map((key) => [key, z.boolean().optional()])) as Record<
        (typeof PREFERENCE_KEYS)[number],
        z.ZodOptional<z.ZodBoolean>
      >,
    },
    guard(async (preferences) => {
      await change((data) => setPreferences(data, preferences));
      return reply('Preferences saved.');
    }),
  );

  /* ── The player in an open tab ───────────────────────────────────────── */

  const listening = async () => {
    const row = await env.DB.prepare('SELECT state, seen_at FROM remote_state WHERE profile_id = ?')
      .bind(profileId)
      .first<{ state: string; seen_at: number }>();
    return row && Date.now() - row.seen_at < LISTENING_MS ? (JSON.parse(row.state) as Record<string, unknown>) : null;
  };
  const NOT_LISTENING =
    'No Vibe Mode tab is listening. Ask the person to open vibe-mode.pages.dev and switch on "Let AI control this tab" in Customize → Cloud save.';

  server.registerTool(
    'player_status',
    {
      title: 'What’s playing',
      description: 'The mode, playlist, track, play state and volume of the tab the person lets the AI control.',
      annotations: { readOnlyHint: true },
    },
    guard(async () => {
      const state = await listening();
      return state ? reply('The listening tab reports:', state) : problem(NOT_LISTENING);
    }),
  );

  server.registerTool(
    'control_player',
    {
      title: 'Control the player',
      description:
        'Send a command to the listening tab: play, pause, next, previous, mute, unmute, set_volume (value 0-100), ' +
        'switch_mode (value = mode id), select_playlist (value = playlist id in the current mode). Applied within ~4 seconds.',
      inputSchema: {
        action: z.enum(['play', 'pause', 'next', 'previous', 'mute', 'unmute', 'set_volume', 'switch_mode', 'select_playlist']),
        value: z.string().max(60).optional(),
      },
    },
    guard(async ({ action, value }) => {
      if (!(await listening())) return problem(NOT_LISTENING);
      if (action === 'set_volume' && !/^\d{1,3}$/.test(value ?? '')) throw new ToolError('set_volume needs a value from 0 to 100.');
      if ((action === 'switch_mode' || action === 'select_playlist') && !value) throw new ToolError(`${action} needs a value.`);
      const now = Date.now();
      await env.DB.batch([
        env.DB.prepare('DELETE FROM remote_commands WHERE profile_id = ? AND created_at < ?').bind(profileId, now - COMMAND_TTL_MS),
        env.DB.prepare('INSERT INTO remote_commands (profile_id, action, value, created_at) VALUES (?, ?, ?, ?)').bind(
          profileId,
          action,
          value ?? null,
          now,
        ),
      ]);
      return reply(`Sent "${action}${value ? ` ${value}` : ''}". The tab applies it within a few seconds; player_status shows the result.`);
    }),
  );
}

function registerOwnerTools(server: McpServer, env: Env) {
  const kind = z.enum(['playlist', 'image', 'poster']);

  server.registerTool(
    'list_site_defaults',
    {
      title: 'List site defaults',
      description: 'Every default row: which YouTube source each built-in playlist plays, and each mode’s background and poster.',
      annotations: { readOnlyHint: true },
    },
    async () => {
      const { results } = await env.DB.prepare('SELECT kind, id, value FROM defaults ORDER BY kind, id').all();
      return reply(`Built-in modes: ${BUILT_IN_MODES.join(', ')}.`, results);
    },
  );

  server.registerTool(
    'set_site_default',
    {
      title: 'Set a site default',
      description:
        'Change what every visitor gets. kind "playlist": id = playlist id, value = YouTube playlist link/id or video ids. ' +
        'kind "image"/"poster": id = mode id, value = /backgrounds/… path or https:// link.',
      inputSchema: { kind, id: z.string().regex(/^[a-z0-9-]{1,60}$/), value: z.string().min(1).max(2000) },
      annotations: { destructiveHint: true },
    },
    guard(async ({ kind: k, id, value }) => {
      const checked = k === 'playlist' ? normaliseSource(value) : safeImageUrl(value.trim());
      if (!checked) {
        throw new ToolError(k === 'playlist' ? 'Not a YouTube playlist or video link/id.' : 'Not an https:// link or /path.');
      }
      await env.DB.prepare('INSERT OR REPLACE INTO defaults (kind, id, value) VALUES (?, ?, ?)').bind(k, id, checked).run();
      return reply(`Set ${k} "${id}". Visitors get it on their next page load.`);
    }),
  );

  server.registerTool(
    'delete_site_default',
    {
      title: 'Delete a site default',
      description: 'Remove a default row: the playlist shows "not set up yet", or the mode falls back to its colour gradient.',
      inputSchema: { kind, id: z.string() },
      annotations: { destructiveHint: true },
    },
    async ({ kind: k, id }) => {
      const result = await env.DB.prepare('DELETE FROM defaults WHERE kind = ? AND id = ?').bind(k, id).run();
      return result.meta.changes ? reply(`Deleted ${k} "${id}".`) : problem(`There is no ${k} "${id}".`);
    },
  );
}
