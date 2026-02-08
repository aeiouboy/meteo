import { readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ingestDocument } from './ingest.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const knowledgeDir = join(__dirname, '..', 'knowledge');

const categoryMap: Record<string, string> = {
  'oms-schema': 'schema',
  'order-status-flow': 'process',
  'troubleshooting': 'troubleshooting',
  'inventory-guide': 'inventory',
};

async function seed() {
  console.log('Seeding knowledge base...\n');
  const files = readdirSync(knowledgeDir).filter(f => f.endsWith('.md'));
  let totalChunks = 0;

  for (const file of files) {
    const name = basename(file, '.md');
    const category = categoryMap[name] || 'general';
    const content = readFileSync(join(knowledgeDir, file), 'utf-8');

    console.log(`Ingesting ${file} (category: ${category})...`);
    const result = await ingestDocument(content, {
      source: file,
      category,
      title: name.replace(/-/g, ' '),
    });
    console.log(`  → ${result.chunksStored} chunks stored`);
    totalChunks += result.chunksStored;
  }

  console.log(`\nDone! Total chunks stored: ${totalChunks}`);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
