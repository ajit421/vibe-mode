// Cloudflare Pages ignores `Range` and always answers 200 with the whole file
// (checked live on vibe-mode.pages.dev). Safari will not play a <video>
// without 206 Partial Content, so background clips are sliced by hand.
// public/_routes.json limits this Function to `*.mp4`: every invocation is a
// billed request (100k/day free), and pictures must stay free static hits.
// shortcut: buffers the whole clip per request — fine for the ~2 MB loops we
// ship; stream or move clips to R2 if one ever approaches the 25 MiB asset cap.

interface Context {
  request: Request;
  next(): Promise<Response>;
}

export const onRequestGet = async ({ request, next }: Context): Promise<Response> => {
  const asset = await next();
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('Range') ?? '');
  if (asset.status !== 200 || !range) {
    const headers = new Headers(asset.headers);
    headers.set('Accept-Ranges', 'bytes');
    return new Response(asset.body, { status: asset.status, headers });
  }

  const body = await asset.arrayBuffer();
  const size = body.byteLength;
  const [, from, to] = range;
  // `bytes=-N` means the last N bytes; `bytes=N-` means N to the end.
  const start = from ? Number(from) : Math.max(0, size - Number(to));
  const end = from && to ? Math.min(Number(to), size - 1) : size - 1;
  if ((!from && !to) || start > end || start >= size) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }

  const headers = new Headers(asset.headers);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(end - start + 1));
  return new Response(body.slice(start, end + 1), { status: 206, headers });
};
