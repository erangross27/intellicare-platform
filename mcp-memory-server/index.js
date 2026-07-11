#!/usr/bin/env node
/**
 * MongoDB-based MCP Memory Server for Claude Code
 * Stores memories and context in local MongoDB
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { MongoClient, ObjectId } from 'mongodb';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read MongoDB URI from KMS file
const MONGO_URI = fs.readFileSync(
  path.join(__dirname, '../apps/backend-api/.kms/MONGODB_ADMIN_URI'),
  'utf8'
).trim();

const DB_NAME = 'claude_memory';
let mongoClient;
let db;
let currentSessionId = null; // Track active session

// Helper: Get current git branch
function getGitBranch(projectDir) {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: projectDir,
      encoding: 'utf8'
    }).trim();
  } catch (err) {
    return null;
  }
}

// Initialize MongoDB connection
async function initMongo() {
  mongoClient = new MongoClient(MONGO_URI);
  await mongoClient.connect();
  db = mongoClient.db(DB_NAME);

  // Create indexes for sessions
  await db.collection('context_session').createIndex({ sessionId: 1 }, { unique: true });
  await db.collection('context_session').createIndex({ status: 1 });
  await db.collection('context_session').createIndex({ projectDir: 1 });
  await db.collection('context_session').createIndex({ claudePid: 1 });  // For multi-instance identification
  await db.collection('context_session').createIndex({ 'metadata.createdAt': -1 });

  // Text index for full-text search on session fields
  await db.collection('context_session').createIndex(
    { name: 'text', 'context.workingOn': 'text', 'context.progress': 'text' },
    {
      name: 'session_text_search',
      weights: { name: 10, 'context.workingOn': 8, 'context.progress': 5 },
      default_language: 'english'
    }
  );

  // Create indexes for memories collection
  // Text index for full-text search on content field
  await db.collection('memories').createIndex(
    { content: 'text', tags: 'text' },
    {
      name: 'memory_text_search',
      weights: { content: 10, tags: 5 },  // Content is 2x more important than tags
      default_language: 'english'
    }
  );

  // Regular indexes for filtering
  await db.collection('memories').createIndex({ project: 1 });
  await db.collection('memories').createIndex({ category: 1 });
  await db.collection('memories').createIndex({ tags: 1 });
  await db.collection('memories').createIndex({ timestamp: -1 });  // Sort by recent

  // Compound indexes for common queries
  await db.collection('memories').createIndex({ project: 1, category: 1 });
  await db.collection('memories').createIndex({ project: 1, timestamp: -1 });

  console.error('✅ Connected to MongoDB: claude_memory with indexes');
}

// Create MCP server
const server = new Server(
  {
    name: 'mongodb-memory',
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
  return {
    tools: [
      {
        name: 'store_memory',
        description: 'Store a new memory in MongoDB',
        inputSchema: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'The memory content to store',
            },
            project: {
              type: 'string',
              description: 'Project name or path (optional)',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tags for categorization (optional)',
            },
            category: {
              type: 'string',
              description: 'Category: general, decision, bug, feature, etc.',
            },
          },
          required: ['content'],
        },
      },
      {
        name: 'recall_memories',
        description: 'Recall memories from MongoDB based on filters. Uses indexed fields for fast retrieval.',
        inputSchema: {
          type: 'object',
          properties: {
            project: {
              type: 'string',
              description: 'Filter by project name (indexed)',
            },
            category: {
              type: 'string',
              description: 'Filter by category (indexed)',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by tags (indexed)',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of memories to return (default: 20, max: 100)',
            },
          },
        },
      },
      {
        name: 'search_memories',
        description: 'Search memories by keyword or phrase using full-text search index. Searches content and tags with relevance scoring.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query (uses MongoDB text search with stemming and stop words)',
            },
            limit: {
              type: 'number',
              description: 'Maximum results (default: 20, max: 100)',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'search_sessions',
        description: 'Search sessions by keyword or phrase using full-text search index. Searches session name, workingOn, and progress fields with relevance scoring.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query (uses MongoDB text search with stemming and stop words)',
            },
            limit: {
              type: 'number',
              description: 'Maximum results (default: 10, max: 50)',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'delete_memory',
        description: 'Delete a specific memory by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'MongoDB ObjectId of the memory',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'update_memory',
        description: 'Update an existing memory by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'MongoDB ObjectId of the memory to update',
            },
            content: {
              type: 'string',
              description: 'Updated memory content (optional)',
            },
            project: {
              type: 'string',
              description: 'Updated project name (optional)',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Updated tags (optional)',
            },
            category: {
              type: 'string',
              description: 'Updated category (optional)',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'start_session',
        description: 'Start a new context session for tracking work progress',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Session name (e.g., "Feature Development", "Bug Fix")',
            },
            projectDir: {
              type: 'string',
              description: 'Project directory path (optional, defaults to cwd)',
            },
            workingOn: {
              type: 'string',
              description: 'What are you working on?',
            },
            goals: {
              type: 'array',
              items: { type: 'string' },
              description: 'Session goals/objectives',
            },
            claudePid: {
              type: 'string',
              description: 'Claude process ID (PPID from hooks) for multi-instance identification',
            },
          },
          required: ['name'],
        },
      },
      {
        name: 'update_session',
        description: 'Update the current active session with new context',
        inputSchema: {
          type: 'object',
          properties: {
            workingOn: {
              type: 'string',
              description: 'Update what you are working on',
            },
            decisions: {
              type: 'array',
              items: { type: 'string' },
              description: 'Add new decisions made',
            },
            progress: {
              type: 'string',
              description: 'Update progress status',
            },
            nextSteps: {
              type: 'array',
              items: { type: 'string' },
              description: 'Update next steps',
            },
          },
        },
      },
      {
        name: 'list_sessions',
        description: 'List all sessions, optionally filtered by status',
        inputSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              description: 'Filter by status: active, paused, completed',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of sessions to return (default: 10)',
            },
          },
        },
      },
      {
        name: 'get_current_session',
        description: 'Get the current active session details',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_session_details',
        description: 'Get detailed information about any session by ID (without activating it)',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Session ID to retrieve details for',
            },
          },
          required: ['sessionId'],
        },
      },
      {
        name: 'get_previous_session',
        description: 'Get the most recent completed/paused session (the session before current). Use this at the start of a new session to understand what was done previously.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'restore_session',
        description: 'Restore and activate a previous session by ID',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Session ID to restore',
            },
          },
          required: ['sessionId'],
        },
      },
      {
        name: 'end_session',
        description: 'Mark the current session as completed',
        inputSchema: {
          type: 'object',
          properties: {
            summary: {
              type: 'string',
              description: 'Final summary of what was accomplished',
            },
          },
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'store_memory') {
    const { content, project, tags, category } = args;

    const memory = {
      content,
      project: project || process.cwd(),
      tags: tags || [],
      category: category || 'general',
      timestamp: new Date(),
    };

    const result = await db.collection('memories').insertOne(memory);

    return {
      content: [{
        type: 'text',
        text: `✅ Memory stored with ID: ${result.insertedId}`,
      }],
    };
  }

  if (name === 'recall_memories') {
    const { project, tags, category, limit } = args;

    const query = {};
    if (project) query.project = project;
    if (category) query.category = category;
    if (tags && tags.length > 0) query.tags = { $in: tags };

    const memories = await db.collection('memories')
      .find(query)
      .sort({ timestamp: -1 })
      .limit(Math.min(limit || 20, 100))  // Default 20, max 100
      .toArray();

    const formatted = memories.map(m =>
      `ID: ${m._id}\n[${m.timestamp.toISOString()}] [${m.category}] ${m.content}\nTags: ${Array.isArray(m.tags) ? m.tags.join(', ') : ''}`
    ).join('\n\n');

    return {
      content: [{
        type: 'text',
        text: formatted || 'No memories found.',
      }],
    };
  }

  if (name === 'search_memories') {
    const { query, limit } = args;

    // Use MongoDB text search for better performance (uses text index)
    const memories = await db.collection('memories')
      .find(
        { $text: { $search: query } },
        { score: { $meta: 'textScore' } }
      )
      .sort({ score: { $meta: 'textScore' }, timestamp: -1 })
      .limit(Math.min(limit || 20, 100))  // Default 20, max 100
      .toArray();

    const formatted = memories.map(m =>
      `ID: ${m._id}\n[${m.timestamp.toISOString()}] [${m.category}] ${m.content}\nTags: ${Array.isArray(m.tags) ? m.tags.join(', ') : ''}\nRelevance: ${Math.round(m.score * 100) / 100}`
    ).join('\n\n');

    return {
      content: [{
        type: 'text',
        text: formatted || 'No matching memories found.',
      }],
    };
  }

  if (name === 'search_sessions') {
    const { query, limit } = args;

    // Search sessions using text index, limit to last 30 days for relevance
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sessions = await db.collection('context_session')
      .find(
        {
          $text: { $search: query },
          'metadata.updatedAt': { $gte: thirtyDaysAgo }  // Recent sessions only
        },
        { score: { $meta: 'textScore' } }
      )
      .sort({ score: { $meta: 'textScore' }, 'metadata.updatedAt': -1 })
      .limit(Math.min(limit || 10, 50))  // Default 10, max 50
      .toArray();

    if (sessions.length === 0) {
      return {
        content: [{
          type: 'text',
          text: 'No matching sessions found.',
        }],
      };
    }

    const formatted = sessions.map(s => {
      const active = s.sessionId === currentSessionId ? ' [ACTIVE]' : '';
      return `${s.name}${active}
  ID: ${s.sessionId}
  Status: ${s.status}
  Working On: ${s.context.workingOn || 'Not set'}
  Progress: ${s.context.progress ? s.context.progress.substring(0, 150) + (s.context.progress.length > 150 ? '...' : '') : 'Not set'}
  Updated: ${s.metadata.updatedAt.toISOString()}
  Relevance: ${Math.round(s.score * 100) / 100}`;
    }).join('\n\n');

    return {
      content: [{
        type: 'text',
        text: formatted,
      }],
    };
  }

  if (name === 'delete_memory') {
    const { id } = args;

    const result = await db.collection('memories').deleteOne({
      _id: new ObjectId(id)
    });

    return {
      content: [{
        type: 'text',
        text: result.deletedCount > 0
          ? `✅ Memory ${id} deleted`
          : `❌ Memory ${id} not found`,
      }],
    };
  }

  if (name === 'update_memory') {
    const { id, content, project, tags, category } = args;

    // Build update object with only provided fields
    const updates = {};
    if (content !== undefined) updates.content = content;
    if (project !== undefined) updates.project = project;
    if (tags !== undefined) updates.tags = tags;
    if (category !== undefined) updates.category = category;
    updates.timestamp = new Date(); // Update timestamp

    if (Object.keys(updates).length === 1) {
      // Only timestamp was added, no actual updates
      return {
        content: [{
          type: 'text',
          text: `❌ No fields provided to update for memory ${id}`,
        }],
      };
    }

    const result = await db.collection('memories').updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      return {
        content: [{
          type: 'text',
          text: `❌ Memory ${id} not found`,
        }],
      };
    }

    // Fetch updated memory to show what changed
    const updatedMemory = await db.collection('memories').findOne({
      _id: new ObjectId(id)
    });

    return {
      content: [{
        type: 'text',
        text: `✅ Memory ${id} updated\n\nUpdated fields: ${Object.keys(updates).filter(k => k !== 'timestamp').join(', ')}\n\nCurrent content: ${updatedMemory.content.substring(0, 200)}${updatedMemory.content.length > 200 ? '...' : ''}`,
      }],
    };
  }

  if (name === 'start_session') {
    const { name: sessionName, projectDir, workingOn, goals, claudePid } = args;

    // End any active session first
    if (currentSessionId) {
      await db.collection('context_session').updateOne(
        { sessionId: currentSessionId },
        {
          $set: {
            status: 'paused',
            'metadata.updatedAt': new Date()
          }
        }
      );
    }

    const sessionId = randomUUID();
    const dir = projectDir || process.cwd();
    const gitBranch = getGitBranch(dir);

    const session = {
      sessionId,
      name: sessionName,
      projectDir: dir,
      gitBranch,
      claudePid: claudePid || null,  // Store Claude process ID for multi-instance identification
      status: 'active',
      context: {
        workingOn: workingOn || '',
        goals: goals || [],
        decisions: [],
        progress: '',
        nextSteps: []
      },
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
        tokenUsage: 0
      }
    };

    await db.collection('context_session').insertOne(session);
    currentSessionId = sessionId;

    return {
      content: [{
        type: 'text',
        text: `✅ Session started: "${sessionName}"\nSession ID: ${sessionId}\nProject: ${dir}\nGit Branch: ${gitBranch || 'N/A'}${claudePid ? `\nClaude PID: ${claudePid}` : ''}`,
      }],
    };
  }

  if (name === 'update_session') {
    if (!currentSessionId) {
      return {
        content: [{
          type: 'text',
          text: '❌ No active session. Start a session first with start_session.',
        }],
      };
    }

    const { workingOn, decisions, progress, nextSteps } = args;
    const updates = {};

    if (workingOn) updates['context.workingOn'] = workingOn;
    if (progress) updates['context.progress'] = progress;
    if (decisions) updates['context.decisions'] = { $each: decisions };
    if (nextSteps) updates['context.nextSteps'] = nextSteps;

    const updateDoc = { $set: { ...updates, 'metadata.updatedAt': new Date() } };
    if (decisions) {
      updateDoc.$push = { 'context.decisions': { $each: decisions } };
      delete updateDoc.$set['context.decisions'];
    }

    await db.collection('context_session').updateOne(
      { sessionId: currentSessionId },
      updateDoc
    );

    return {
      content: [{
        type: 'text',
        text: `✅ Session updated: ${currentSessionId}`,
      }],
    };
  }

  if (name === 'list_sessions') {
    const { status, limit } = args;
    const query = status ? { status } : {};

    const sessions = await db.collection('context_session')
      .find(query)
      .sort({ 'metadata.createdAt': -1 })
      .limit(Math.min(limit || 20, 100))  // Default 20, max 100
      .toArray();

    if (sessions.length === 0) {
      return {
        content: [{
          type: 'text',
          text: 'No sessions found.',
        }],
      };
    }

    const formatted = sessions.map(s => {
      const active = s.sessionId === currentSessionId ? ' [ACTIVE]' : '';
      return `${s.name}${active}\n  ID: ${s.sessionId}\n  Status: ${s.status}\n  Project: ${s.projectDir}\n  Branch: ${s.gitBranch || 'N/A'}\n  Created: ${s.metadata.createdAt.toISOString()}\n  Working On: ${s.context.workingOn || 'Not set'}`;
    }).join('\n\n');

    return {
      content: [{
        type: 'text',
        text: formatted,
      }],
    };
  }

  if (name === 'get_current_session') {
    if (!currentSessionId) {
      return {
        content: [{
          type: 'text',
          text: '❌ No active session.',
        }],
      };
    }

    const session = await db.collection('context_session').findOne({
      sessionId: currentSessionId
    });

    if (!session) {
      currentSessionId = null;
      return {
        content: [{
          type: 'text',
          text: '❌ Active session not found in database.',
        }],
      };
    }

    const formatted = `📍 Current Session: ${session.name}
ID: ${session.sessionId}
Status: ${session.status}
Project: ${session.projectDir}
Branch: ${session.gitBranch || 'N/A'}

🎯 Working On:
${session.context.workingOn || 'Not set'}

📋 Goals:
${session.context.goals.length > 0 ? session.context.goals.map((g, i) => `${i + 1}. ${g}`).join('\n') : 'None set'}

✅ Decisions Made:
${session.context.decisions.length > 0 ? session.context.decisions.map((d, i) => `${i + 1}. ${d}`).join('\n') : 'None yet'}

📊 Progress:
${session.context.progress || 'Not set'}

⏭️ Next Steps:
${session.context.nextSteps.length > 0 ? session.context.nextSteps.map((s, i) => `${i + 1}. ${s}`).join('\n') : 'None set'}

🕐 Created: ${session.metadata.createdAt.toISOString()}
🕐 Updated: ${session.metadata.updatedAt.toISOString()}`;

    return {
      content: [{
        type: 'text',
        text: formatted,
      }],
    };
  }

  if (name === 'get_session_details') {
    const { sessionId } = args;

    const session = await db.collection('context_session').findOne({ sessionId });

    if (!session) {
      return {
        content: [{
          type: 'text',
          text: `❌ Session ${sessionId} not found.`,
        }],
      };
    }

    const formatted = `📍 Session: ${session.name}
ID: ${session.sessionId}
Status: ${session.status}
Project: ${session.projectDir}
Branch: ${session.gitBranch || 'N/A'}

🎯 Working On:
${session.context.workingOn || 'Not set'}

📋 Goals:
${session.context.goals.length > 0 ? session.context.goals.map((g, i) => `${i + 1}. ${g}`).join('\n') : 'None set'}

✅ Decisions Made:
${session.context.decisions.length > 0 ? session.context.decisions.map((d, i) => `${i + 1}. ${d}`).join('\n') : 'None yet'}

📊 Progress:
${session.context.progress || 'Not set'}

⏭️ Next Steps:
${session.context.nextSteps.length > 0 ? session.context.nextSteps.map((s, i) => `${i + 1}. ${s}`).join('\n') : 'None set'}

🕐 Created: ${session.metadata.createdAt.toISOString()}
🕐 Updated: ${session.metadata.updatedAt.toISOString()}`;

    return {
      content: [{
        type: 'text',
        text: formatted,
      }],
    };
  }

  if (name === 'get_previous_session') {
    // Get the most recently updated session (any status) excluding current session
    const previousSession = await db.collection('context_session')
      .find({
        sessionId: { $ne: currentSessionId } // Exclude current session only
      })
      .sort({ 'metadata.updatedAt': -1 }) // Most recently updated first
      .limit(1)
      .toArray();

    if (previousSession.length === 0) {
      return {
        content: [{
          type: 'text',
          text: '❌ No previous session found.',
        }],
      };
    }

    const session = previousSession[0];

    const formatted = `📍 Previous Session: ${session.name}
ID: ${session.sessionId}
Status: ${session.status}
Project: ${session.projectDir}
Branch: ${session.gitBranch || 'N/A'}

🎯 Working On:
${session.context.workingOn || 'Not set'}

📋 Goals:
${session.context.goals.length > 0 ? session.context.goals.map((g, i) => `${i + 1}. ${g}`).join('\n') : 'None set'}

✅ Decisions Made (${session.context.decisions.length} total):
${session.context.decisions.length > 0 ? session.context.decisions.map((d, i) => `${i + 1}. ${d}`).join('\n') : 'None yet'}

📊 Progress:
${session.context.progress || 'Not set'}

⏭️ Next Steps:
${session.context.nextSteps.length > 0 ? session.context.nextSteps.map((s, i) => `${i + 1}. ${s}`).join('\n') : 'None set'}

🕐 Created: ${session.metadata.createdAt.toISOString()}
🕐 Updated: ${session.metadata.updatedAt.toISOString()}`;

    return {
      content: [{
        type: 'text',
        text: formatted,
      }],
    };
  }

  if (name === 'restore_session') {
    const { sessionId } = args;

    const session = await db.collection('context_session').findOne({ sessionId });

    if (!session) {
      return {
        content: [{
          type: 'text',
          text: `❌ Session ${sessionId} not found.`,
        }],
      };
    }

    // Pause current session if exists
    if (currentSessionId) {
      await db.collection('context_session').updateOne(
        { sessionId: currentSessionId },
        {
          $set: {
            status: 'paused',
            'metadata.updatedAt': new Date()
          }
        }
      );
    }

    // Activate restored session
    await db.collection('context_session').updateOne(
      { sessionId },
      {
        $set: {
          status: 'active',
          'metadata.updatedAt': new Date(),
          'metadata.lastAccessedAt': new Date()
        }
      }
    );

    currentSessionId = sessionId;

    return {
      content: [{
        type: 'text',
        text: `✅ Restored session: "${session.name}"\nSession ID: ${sessionId}\nWorking On: ${session.context.workingOn || 'Not set'}`,
      }],
    };
  }

  if (name === 'end_session') {
    if (!currentSessionId) {
      return {
        content: [{
          type: 'text',
          text: '❌ No active session to end.',
        }],
      };
    }

    const { summary } = args;

    await db.collection('context_session').updateOne(
      { sessionId: currentSessionId },
      {
        $set: {
          status: 'completed',
          'context.progress': summary || 'Session completed',
          'metadata.updatedAt': new Date()
        }
      }
    );

    const sessionId = currentSessionId;
    currentSessionId = null;

    return {
      content: [{
        type: 'text',
        text: `✅ Session ended: ${sessionId}\nSummary: ${summary || 'Session completed'}`,
      }],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Start server
async function main() {
  await initMongo();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('🧠 MongoDB Memory MCP Server running');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
