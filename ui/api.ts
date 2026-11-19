/** Thin client for the local studio API. All edits go to the same files the agents use. */
export interface FileDoc { path: string; content: string; hash: string }
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error((data as { error?: string }).error ?? `HTTP ${r.status}`), { status: r.status, data });
  return data as T;
}
export const getFile = (project: string, path: string) => api<FileDoc>(`/api/project/${project}/file?path=${encodeURIComponent(path)}`);
export const putFile = (project: string, path: string, content: string, expectedHash: string | null) => api<{ hash: string }>(`/api/project/${project}/file`, { method: 'PUT', body: JSON.stringify({ path, content, expectedHash }) });
/** Read-modify-write a JSON file with optimistic concurrency (retries once on conflict). */
export async function updateJson<T>(project: string, path: string, fn: (obj: T) => T | void): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const f = await getFile(project, path);
    const obj = JSON.parse(f.content) as T;
    const next = fn(obj) ?? obj;
    try { await putFile(project, path, JSON.stringify(next, null, 2) + '\n', f.hash); return; }
    catch (e) { if ((e as { status?: number }).status !== 409 || attempt) throw e; }
  }
}
export function subscribe(project: string, on: (ev: string, data: unknown) => void): () => void {
  let es: EventSource | null = null; let closed = false;
  const open = () => {
    es = new EventSource(`/api/events?project=${project}`);
    for (const ev of ['change', 'job', 'hello']) es.addEventListener(ev, e => on(ev, JSON.parse((e as MessageEvent).data)));
    es.onerror = () => { es?.close(); if (!closed) setTimeout(open, 1500); };
  };
  open();
  return () => { closed = true; es?.close(); };
}
