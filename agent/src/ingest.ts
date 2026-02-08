import { generateEmbedding, generateEmbeddings } from './embeddings.js';
import { storeDocumentChunk, matchDocuments } from './supabase.js';

export function chunkText(
  text: string,
  options?: { chunkSize?: number; overlap?: number }
): string[] {
  const chunkSize = options?.chunkSize ?? 800;
  const overlap = options?.overlap ?? 120;

  // Split into paragraphs first
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > chunkSize && current.length > 0) {
      chunks.push(current.trim());
      // Keep overlap from end of current chunk
      const overlapText = current.slice(-overlap);
      current = overlapText + '\n\n' + para;
    } else {
      current = current ? current + '\n\n' + para : para;
    }
  }
  if (current.trim()) {
    chunks.push(current.trim());
  }

  // Handle any remaining oversized chunks by splitting on sentences
  const result: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length <= chunkSize * 1.5) {
      result.push(chunk);
    } else {
      const sentences = chunk.split(/(?<=[.!?])\s+/);
      let sub = '';
      for (const sentence of sentences) {
        if (sub.length + sentence.length + 1 > chunkSize && sub.length > 0) {
          result.push(sub.trim());
          sub = sub.slice(-overlap) + ' ' + sentence;
        } else {
          sub = sub ? sub + ' ' + sentence : sentence;
        }
      }
      if (sub.trim()) result.push(sub.trim());
    }
  }

  return result.length > 0 ? result : [text];
}

export async function ingestDocument(
  content: string,
  metadata: Record<string, unknown>
): Promise<{ chunksStored: number }> {
  const chunks = chunkText(content);
  const embeddings = await generateEmbeddings(chunks);

  for (let i = 0; i < chunks.length; i++) {
    await storeDocumentChunk(
      chunks[i],
      { ...metadata, chunk_index: i, ingested_at: new Date().toISOString() },
      embeddings[i]
    );
  }

  return { chunksStored: chunks.length };
}

export async function searchDocuments(
  query: string,
  options?: { matchCount?: number; threshold?: number }
): Promise<Array<{ content: string; metadata: unknown; similarity: number }>> {
  const queryEmbedding = await generateEmbedding(query);
  return matchDocuments(
    queryEmbedding,
    options?.matchCount ?? 5,
    options?.threshold ?? 0.5
  );
}
