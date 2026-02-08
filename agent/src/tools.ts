import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import { executeOmsQuery } from './supabase.js';
import { searchDocuments } from './ingest.js';

export const tools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'execute_oms_query',
      description: `Execute a SQL SELECT query against the Meteo OMS database on Supabase. Only SELECT queries are allowed.

Available tables (always use oms. prefix):
- oms.orders (15 rows) — order_id, short_order_number, customer info, order_status, fulfillment_status, payment_status, order_total, created_at
- oms.order_lines (39 rows) — order_id, item_id (EAN), item_description (Thai), quantity, uom, unit_price
- oms.allocations (39 rows) — order_id, order_line_id, ship_from_location_id, quantity, carrier_code
- oms.releases (17 rows) — order_id, release_id, ship_from_location_id, carrier_code
- oms.release_lines (39 rows) — order_id, release_id, item_id, quantity
- oms.fulfillment_details (38 rows) — order_id, order_line_id, fulfillment_status, quantity
- oms.payments (15 rows) — order_id, payment_id, status_id
- oms.inventory_stock (100 rows) — store_id (004/005/007), sku, onhand, reserved, inbound
- oms.log_workflow_events (168 rows) — order_id, event_type, previous_status, new_status, event_timestamp

Example: SELECT order_id, order_status FROM oms.orders LIMIT 10`,
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Complete SQL SELECT query. Must start with SELECT. Use oms. schema prefix for all tables. Always include LIMIT (max 50).',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_knowledge_base',
      description: 'Search the OMS knowledge base for documentation, procedures, troubleshooting guides, and how-to information. Use this for questions about processes, workflows, status meanings, or how things work — NOT for querying live data.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Natural language search query describing what information you need',
          },
          category: {
            type: 'string',
            enum: ['schema', 'process', 'troubleshooting', 'inventory', 'all'],
            description: 'Optional category to narrow search scope',
          },
        },
        required: ['query'],
      },
    },
  },
];

export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  if (name === 'execute_oms_query') {
    const result = await executeOmsQuery(args.query as string);
    return JSON.stringify(result, null, 2);
  }

  if (name === 'search_knowledge_base') {
    const results = await searchDocuments(args.query as string, { matchCount: 5 });
    const category = args.category as string | undefined;

    const filtered = category && category !== 'all'
      ? results.filter(r => (r.metadata as any)?.category === category)
      : results;

    if (filtered.length === 0) {
      return JSON.stringify({ message: 'No relevant documents found.' });
    }

    const formatted = filtered.map((r, i) => {
      const meta = r.metadata as Record<string, unknown>;
      return `[${i + 1}] (similarity: ${r.similarity.toFixed(3)}, source: ${meta.source || 'unknown'})\n${r.content}`;
    }).join('\n\n---\n\n');

    return formatted;
  }

  return JSON.stringify({ error: `Unknown tool: ${name}` });
}
