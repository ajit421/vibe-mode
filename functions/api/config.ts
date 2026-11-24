// The site's defaults (which playlist each built-in playlist plays, and each
// mode's background and poster), read from the `defaults` table in D1. See
// migrations/0001_defaults.sql for what a row means.
//
// One invocation per page load. The browser keeps the last answer in
// localStorage and paints with it straight away, so this only ever refreshes.
// Never throws: a failure answers 503 and the browser keeps what it had.

interface D1Like {
  prepare(query: string): { all<T>(): Promise<{ results: T[] }> };
}

interface Context {
  env: { DB?: D1Like };
}

interface Row {
  kind: string;
  id: string;
  value: string;
}

const GROUPS: Record<string, 'playlists' | 'images' | 'posters'> = {
  playlist: 'playlists',
  image: 'images',
  poster: 'posters',
};

export const onRequestGet = async ({ env }: Context): Promise<Response> => {
  if (!env.DB) return Response.json({ error: 'No DB binding.' }, { status: 503 });

  try {
    const { results } = await env.DB.prepare('SELECT kind, id, value FROM defaults').all<Row>();
    const body: Record<'playlists' | 'images' | 'posters', Record<string, string>> = {
      playlists: {},
      images: {},
      posters: {},
    };
    for (const row of results) {
      const group = GROUPS[row.kind];
      if (group && row.value.trim()) body[group][row.id] = row.value.trim();
    }
    // `no-cache`: a row edited in the dashboard should show on the next load.
    return Response.json(body, { headers: { 'Cache-Control': 'no-cache' } });
  } catch {
    return Response.json({ error: 'Could not read defaults.' }, { status: 503 });
  }
};
