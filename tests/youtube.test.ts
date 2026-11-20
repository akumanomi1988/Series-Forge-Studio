// YouTube publishing protocol: OAuth loopback + PKCE and resumable upload, exercised against a local HTTP server
// that speaks the same protocol as Google's endpoints (no network, no real account).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const secrets = await mkdtemp(join(tmpdir(), 'sf-yt-'));
process.env.SERIES_FORGE_SECRETS_DIR = secrets;
const yt = await import('../src/pipeline/youtube.ts');

test('youtube: OAuth loopback + PKCE, token refresh and resumable upload', async () => {
  let challenge = '', uploaded = Buffer.alloc(0), metadata: Record<string, unknown> = {}, puts = 0, tokenCalls = 0;
  const srv = createServer(async (req, res) => {
    const chunks: Buffer[] = []; for await (const c of req) chunks.push(c as Buffer);
    const body = Buffer.concat(chunks); const u = new URL(req.url!, 'http://x');
    if (u.pathname === '/token') {
      tokenCalls++;
      const p = new URLSearchParams(body.toString());
      if (p.get('grant_type') === 'authorization_code') {
        assert.equal(createHash('sha256').update(p.get('code_verifier')!).digest('base64url'), challenge, 'PKCE verifier must match the challenge');
        assert.equal(p.get('code'), 'abc');
        res.end(JSON.stringify({ access_token: 'AT1', refresh_token: 'RT', expires_in: 1 })); return; // expires at once -> forces a refresh
      }
      assert.equal(p.get('refresh_token'), 'RT');
      res.end(JSON.stringify({ access_token: 'AT2', expires_in: 3600 })); return;
    }
    if (u.pathname === '/api/channels') { res.end(JSON.stringify({ items: [{ id: 'UC1', snippet: { title: 'Mi canal' } }] })); return; }
    if (u.pathname === '/upload/youtube/v3/videos' && req.method === 'POST') {
      assert.equal(req.headers.authorization, 'Bearer AT2');
      metadata = JSON.parse(body.toString());
      res.writeHead(200, { location: `http://127.0.0.1:${port}/upload/youtube/v3/videos?upload_id=1` }).end(); return;
    }
    if (u.pathname === '/upload/youtube/v3/videos' && req.method === 'PUT') {
      puts++;
      const [, a, , total] = /bytes (\d+)-(\d+)\/(\d+)/.exec(String(req.headers['content-range']))!;
      assert.equal(Number(a), uploaded.length, 'chunks must continue where the server stopped');
      // the server keeps only half of the first chunk: the client must resend from the reported range
      const keep = puts === 1 ? body.subarray(0, Math.floor(body.length / 2)) : body;
      uploaded = Buffer.concat([uploaded, keep]);
      if (uploaded.length < Number(total)) { res.writeHead(308, { range: `bytes=0-${uploaded.length - 1}` }).end(); return; }
      res.writeHead(200).end(JSON.stringify({ id: 'VID123', status: { privacyStatus: 'private' } })); return;
    }
    res.writeHead(404).end();
  });
  await new Promise<void>(ok => srv.listen(0, '127.0.0.1', ok));
  const port = (srv.address() as { port: number }).port;
  const ep = { auth: `http://127.0.0.1:${port}/auth`, token: `http://127.0.0.1:${port}/token`, revoke: `http://127.0.0.1:${port}/revoke`, api: `http://127.0.0.1:${port}/api`, upload: `http://127.0.0.1:${port}/upload/youtube/v3` };
  try {
    await assert.rejects(yt.saveClient({ installed: { client_id: 'nope', client_secret: 'x' } }), /client_id/);
    await yt.saveClient({ installed: { client_id: '123-abc.apps.googleusercontent.com', client_secret: 'shh' } });
    await assert.rejects(yt.authUrl('https://evil.example/cb', ep), /local/);
    const url = new URL(await yt.authUrl('http://127.0.0.1:9/callback', ep));
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    assert.match(url.searchParams.get('scope')!, /youtube\.upload/);
    challenge = url.searchParams.get('code_challenge')!;
    await assert.rejects(yt.completeAuth(new URLSearchParams({ state: 'forged', code: 'abc' }), ep), /state/);
    const r = await yt.completeAuth(new URLSearchParams({ state: url.searchParams.get('state')!, code: 'abc' }), ep);
    assert.equal(r.channel?.title, 'Mi canal');
    assert.equal((await yt.status()).connected, true);

    const file = join(secrets, 'v.mp4'); const data = Buffer.alloc(9 * 1024 * 1024 + 123, 7); await writeFile(file, data);
    const events: string[] = [];
    const up = await yt.uploadVideo(file, { title: 'Ep <1>', description: 'd', tags: ['a'], privacy: 'private', madeForKids: false, containsSyntheticMedia: true }, e => events.push(e.stage), ep);
    assert.equal(up.videoId, 'VID123');
    assert.equal(up.privacy, 'private');
    assert.ok(uploaded.equals(data), 'uploaded bytes must equal the file');
    assert.equal(puts, 2, 'second chunk resumed from the byte the server reported');
    assert.equal((metadata.snippet as { title: string }).title, 'Ep 1');
    assert.deepEqual(metadata.status, { privacyStatus: 'private', selfDeclaredMadeForKids: false, containsSyntheticMedia: true });
    assert.ok(tokenCalls >= 2, 'expired access token was refreshed');
    assert.equal(events.at(-1), 'done');
    assert.throws(() => yt.validateMeta({ title: '  ', description: '', privacy: 'private', madeForKids: false, containsSyntheticMedia: true }), /título/);
  } finally { srv.close(); await rm(secrets, { recursive: true, force: true }); }
});
