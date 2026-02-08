import OpenAI from 'openai';
import { config } from './config.js';

// Reuse OpenRouter credentials — OpenRouter supports /v1/embeddings endpoint
const embeddingClient = new OpenAI({
  apiKey: config.openRouterApiKey,
  baseURL: config.openRouterBaseUrl,
});

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await embeddingClient.embeddings.create({
    model: config.embeddingModel,
    input: text,
  });
  return response.data[0].embedding;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await embeddingClient.embeddings.create({
    model: config.embeddingModel,
    input: texts,
  });
  return response.data.map(d => d.embedding);
}
