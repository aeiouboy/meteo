import { config } from './config.js';

export async function executeOmsQuery(sql: string): Promise<unknown> {
  const trimmed = sql.trim().replace(/;+$/, '');

  if (!trimmed.toUpperCase().startsWith('SELECT')) {
    return { error: 'Only SELECT queries are allowed.' };
  }

  const res = await fetch(
    `${config.supabaseUrl}/rest/v1/rpc/execute_oms_query`,
    {
      method: 'POST',
      headers: {
        apikey: config.supabaseKey,
        Authorization: `Bearer ${config.supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ query_text: trimmed }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    return { error: `Supabase error ${res.status}: ${text}` };
  }

  return res.json();
}

export async function storeDocumentChunk(
  content: string,
  metadata: Record<string, unknown>,
  embedding: number[]
): Promise<void> {
  const res = await fetch(`${config.supabaseUrl}/rest/v1/documents`, {
    method: 'POST',
    headers: {
      apikey: config.supabaseKey,
      Authorization: `Bearer ${config.supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ content, metadata, embedding }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to store document: ${res.status} ${text}`);
  }
}

export async function matchDocuments(
  queryEmbedding: number[],
  matchCount = 5,
  threshold = 0.5
): Promise<Array<{ id: string; content: string; metadata: unknown; similarity: number }>> {
  const res = await fetch(`${config.supabaseUrl}/rest/v1/rpc/match_documents`, {
    method: 'POST',
    headers: {
      apikey: config.supabaseKey,
      Authorization: `Bearer ${config.supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: matchCount,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`match_documents failed: ${res.status} ${text}`);
  }
  return res.json();
}
