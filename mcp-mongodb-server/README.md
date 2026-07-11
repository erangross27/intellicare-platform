# IntelliCare MongoDB MCP Server

A Model Context Protocol (MCP) server that provides read-only access to IntelliCare's MongoDB databases for AI assistants like Kimi and Claude Code.

## Features

- **List databases** - See all IntelliCare databases
- **List collections** - Browse collections in any database
- **Find documents** - Query with filters, sorting, and projections
- **Count documents** - Get collection statistics
- **Find by ID** - Lookup specific documents
- **Aggregate** - Run aggregation pipelines
- **Search patients** - Cross-practice patient search
- **Get patient data** - Retrieve all medical data for a patient

## Installation

Dependencies are already installed:
```bash
npm install
```

## Usage

### With Kimi

The MCP server is configured in `~/.kimi/config.toml`:

```toml
[[mcp.servers]]
name = "intellicare-mongodb"
type = "stdio"
command = "node"
args = ["/home/erangross/IntelliCare/mcp-mongodb-server/index.js"]
```

### With Claude Code

Add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "intellicare-mongodb": {
      "type": "stdio",
      "command": "node",
      "args": ["/home/erangross/IntelliCare/mcp-mongodb-server/index.js"]
    }
  }
}
```

## Available Tools

### list_databases
List all IntelliCare databases.

### list_collections
```json
{
  "database": "intellicare_practice_yale"
}
```

### find_documents
```json
{
  "database": "intellicare_practice_yale",
  "collection": "patients",
  "filter": { "firstName": "David" },
  "limit": 10
}
```

### count_documents
```json
{
  "database": "intellicare_practice_yale",
  "collection": "patients"
}
```

### find_by_id
```json
{
  "database": "intellicare_practice_yale",
  "collection": "patients",
  "id": "68d16e929b6f26e386161f29"
}
```

### aggregate
```json
{
  "database": "intellicare_practice_yale",
  "collection": "patients",
  "pipeline": [
    { "$match": { "gender": "male" } },
    { "$group": { "_id": "$gender", "count": { "$sum": 1 } } }
  ]
}
```

### search_patients
```json
{
  "practice": "yale",
  "name": "David Wilson",
  "limit": 5
}
```

Use `"practice": "all"` to search across all practices.

### get_patient_data
```json
{
  "database": "intellicare_practice_yale",
  "patientId": "68d16e929b6f26e386161f29"
}
```

## Testing

Run the connection test:
```bash
node test-connection.js
```

## Security

- Read-only access by design
- Uses existing MongoDB admin credentials from `.env`
- No external network access required
- All data stays on localhost

## Database Naming

- `intellicare_practice_global` - Global/shared data
- `intellicare_practice_<name>` - Individual practice data (e.g., `yale`)
- `intellicare_drug_data` - Drug and medication data
