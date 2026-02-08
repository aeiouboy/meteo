import express from 'express';
import { Agent } from './agent.js';
import { config } from './config.js';
import { ingestDocument } from './ingest.js';

const app = express();
app.use(express.json());

// Session store: sessionId -> Agent instance
const sessions = new Map<string, Agent>();

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    model: config.model,
    sessions: sessions.size,
  });
});

app.post('/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body as {
      message?: string;
      sessionId?: string;
    };

    if (!message) {
      res.status(400).json({ error: 'message is required' });
      return;
    }

    const sid = sessionId || crypto.randomUUID();

    if (!sessions.has(sid)) {
      sessions.set(sid, new Agent());
    }

    const agent = sessions.get(sid)!;
    console.log(`\n[${sid.slice(0, 8)}] User: ${message}`);

    const response = await agent.chat(message);
    console.log(`[${sid.slice(0, 8)}] Agent: ${response.slice(0, 100)}...`);

    res.json({ response, sessionId: sid });
  } catch (err) {
    console.error('Chat error:', err);
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// Delete a session
app.delete('/session/:id', (req, res) => {
  sessions.delete(req.params.id);
  res.json({ deleted: true });
});

app.post('/ingest', async (req, res) => {
  try {
    const { content, metadata } = req.body as {
      content?: string;
      metadata?: Record<string, unknown>;
    };
    if (!content) {
      res.status(400).json({ error: 'content is required' });
      return;
    }
    const result = await ingestDocument(content, metadata || {});
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Ingest error:', err);
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

app.get('/knowledge/stats', async (_req, res) => {
  try {
    const { config: cfg } = await import('./config.js');
    const statsRes = await fetch(
      `${cfg.supabaseUrl}/rest/v1/rpc/execute_oms_query`,
      {
        method: 'POST',
        headers: {
          apikey: cfg.supabaseKey,
          Authorization: `Bearer ${cfg.supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query_text: "SELECT metadata->>'category' as category, count(*) as count FROM documents GROUP BY 1",
        }),
      }
    );
    if (!statsRes.ok) {
      // Fallback: query documents table directly via REST
      const directRes = await fetch(
        `${cfg.supabaseUrl}/rest/v1/documents?select=metadata`,
        {
          headers: {
            apikey: cfg.supabaseKey,
            Authorization: `Bearer ${cfg.supabaseKey}`,
          },
        }
      );
      const docs = await directRes.json() as Array<{ metadata: Record<string, unknown> }>;
      const categories: Record<string, number> = {};
      for (const d of docs) {
        const cat = (d.metadata?.category as string) || 'unknown';
        categories[cat] = (categories[cat] || 0) + 1;
      }
      res.json({ totalDocuments: docs.length, categories });
      return;
    }
    const stats = await statsRes.json();
    res.json({ stats });
  } catch (err) {
    console.error('Stats error:', err);
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

app.listen(config.port, () => {
  console.log(`Meteo OMS Agent running on http://localhost:${config.port}`);
  console.log(`Model: ${config.model}`);
  console.log(`Supabase: ${config.supabaseUrl}`);
  console.log(`\nEndpoints:`);
  console.log(`  GET  /health`);
  console.log(`  POST /chat   { "message": "...", "sessionId?": "..." }`);
  console.log(`  POST /ingest  { "content": "...", "metadata": { ... } }`);
  console.log(`  GET  /knowledge/stats`);
});
