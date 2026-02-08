import * as readline from 'node:readline';
import { Agent } from './agent.js';
import { config } from './config.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const agent = new Agent();

console.log('Meteo OMS AI Assistant (CLI)');
console.log(`Model: ${config.model}`);
console.log('Type your question, or "quit" to exit.\n');

function prompt() {
  rl.question('You: ', async (input) => {
    const trimmed = input.trim();
    if (!trimmed || trimmed === 'quit' || trimmed === 'exit') {
      console.log('Bye!');
      rl.close();
      process.exit(0);
    }

    try {
      const response = await agent.chat(trimmed);
      console.log(`\nAgent: ${response}\n`);
    } catch (err) {
      console.error('Error:', err instanceof Error ? err.message : err);
    }

    prompt();
  });
}

prompt();
