# MongoDB Memory MCP Server

A custom Model Context Protocol (MCP) server that provides persistent memory capabilities for Claude Code using your existing MongoDB database.

## Features

- **Local-only storage**: All memories stored in your local MongoDB (no external services)
- **Project-aware**: Organize memories by project
- **Categorization**: Tag and categorize memories
- **Fast search**: Regex-based search across content and tags
- **Zero dependencies**: Uses existing MongoDB infrastructure

## Installation

Already installed! The server is located at:
```
/home/erangross/Development/IntelliCare/mcp-memory-server/
```

## Database

- **Database**: `claude_memory`
- **Collection**: `memories`
- **Connection**: Uses existing MongoDB from `apps/backend-api/.kms/MONGODB_ADMIN_URI`

## Available Tools

### 1. `store_memory`
Store a new memory in MongoDB.

**Parameters:**
- `content` (required): The memory content
- `project` (optional): Project name or path
- `tags` (optional): Array of tags
- `category` (optional): Category (general, decision, bug, feature, etc.)

**Example usage in Claude Code:**
```
Store this memory: "The IntelliCare frontend uses Vite for bundling" with tags ["frontend", "build"] and category "architecture"
```

### 2. `recall_memories`
Retrieve memories based on filters.

**Parameters:**
- `project` (optional): Filter by project
- `category` (optional): Filter by category
- `tags` (optional): Filter by tags
- `limit` (optional): Max results (default: 10)

**Example:**
```
Recall all memories tagged with "mongodb"
```

### 3. `search_memories`
Search memories by keyword.

**Parameters:**
- `query` (required): Search text
- `limit` (optional): Max results (default: 10)

**Example:**
```
Search memories for "authentication flow"
```

### 4. `delete_memory`
Delete a specific memory by ID.

**Parameters:**
- `id` (required): MongoDB ObjectId

**Example:**
```
Delete memory with ID 67abc123def456789
```

## How to Use

Just ask Claude Code naturally! The memory tools are automatically available:

```
"Remember that we use MongoDB for all medical data storage"
"What do you remember about the authentication system?"
"Search your memories for anything about the artifact panel"
"Recall memories tagged with 'bug' from the last session"
```

## Configuration

The server is registered with Claude Code in:
```
~/.claude.json
```

Server configuration:
```json
{
  "mongodb-memory": {
    "type": "stdio",
    "command": "node",
    "args": ["/home/erangross/Development/IntelliCare/mcp-memory-server/index.js"]
  }
}
```

## Verify Installation

Check server status:
```bash
claude mcp list
```

You should see:
```
mongodb-memory: node /home/erangross/Development/IntelliCare/mcp-memory-server/index.js - ✓ Connected
```

## Troubleshooting

**Server not connecting?**
```bash
# Test manually
cd /home/erangross/Development/IntelliCare/mcp-memory-server
node index.js
```

**View stored memories directly:**
```bash
MONGO_URI=$(cat ../apps/backend-api/.kms/MONGODB_ADMIN_URI)
mongosh "$MONGO_URI" --quiet --eval "db = db.getSiblingDB('claude_memory'); db.memories.find().pretty()"
```

## Memory Schema

```javascript
{
  _id: ObjectId("..."),
  content: "Memory text",
  project: "/path/to/project",
  tags: ["tag1", "tag2"],
  category: "decision",
  timestamp: ISODate("2025-10-25T...")
}
```

## Benefits

✅ **Privacy**: All data stays on your local machine
✅ **Integration**: Uses existing MongoDB infrastructure
✅ **Persistence**: Memories survive across sessions
✅ **Searchable**: Fast keyword and tag-based search
✅ **Zero cost**: No external API calls or subscriptions

---

**Created**: October 2025
**Author**: IntelliCare Development Team
