#!/usr/bin/env node

/**
 * Browser Agent MCP Server
 * Provides browser automation tools for WS Workspace
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'crypto';
import { BridgeClient } from './bridge-client.js';
import { createTools, executeToolCall } from './tools.js';

// Initialize Bridge Client
const BRIDGE_URL = process.env.BRIDGE_URL || 'http://localhost:18793';
// Stable per-session ID: one MCP server process == one Claude session (stdio
// transport). The extension scopes tab groups by this — parallel sessions on
// the same profile get separate groups and can't hijack each other's tabs.
const SESSION_ID = randomUUID();
const bridgeClient = new BridgeClient(BRIDGE_URL, SESSION_ID);

// Initialize MCP Server
const server = new Server(
  {
    name: 'browser-agent-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = createTools();
  return { tools };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    console.error(`[MCP] Executing tool: ${name}`);

    // Execute tool
    const result = await executeToolCall(name, args || {}, bridgeClient);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: errorMessage }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  console.error('[MCP] Starting Browser Agent MCP Server...');
  console.error(`[MCP] Bridge URL: ${BRIDGE_URL}`);

  // Check Bridge health
  try {
    const health = await bridgeClient.checkHealth();
    console.error(`[MCP] Bridge Server: ${health.status} (${health.profiles} profiles connected)`);
  } catch (error) {
    console.error('[MCP] WARNING: Cannot connect to Bridge Server');
    console.error('[MCP] Make sure Bridge Server is running: npm start (in bridge directory)');
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[MCP] Browser Agent MCP Server ready');
}

main().catch((error) => {
  console.error('[MCP] Fatal error:', error);
  process.exit(1);
});
