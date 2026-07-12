# MCP Setup Summary for IntelliCare

## ✅ Completed Tasks

### 1. Anthropic API Key Updated

**New API Key stored in KMS:**
- Location: `/home/erangross/IntelliCare/apps/backend-api/.kms/keys/ANTHROPIC_API_KEY.json`
- Key preview: `sk-ant-api03-Ti...lrRylwAA`
- Status: ✅ Verified working

**Files updated:**
- KMS encrypted key storage

**Verification:**
```bash
cd /home/erangross/IntelliCare/apps/backend-api
node scripts/test-anthropic-key.js
```

Output:
```
✅ API call successful!
📝 Response: IntelliCare API key is working
```

---

### 2. MCP MongoDB Server Created

**Location:** `/home/erangross/IntelliCare/mcp-mongodb-server/`

**Features:**
- Read-only access to IntelliCare MongoDB databases
- 8 powerful tools for data exploration
- Cross-practice patient search
- Medical data retrieval

**Available Tools:**

| Tool | Description |
|------|-------------|
| `list_databases` | List all IntelliCare databases |
| `list_collections` | Browse collections in a database |
| `find_documents` | Query documents with filters |
| `count_documents` | Get collection statistics |
| `find_by_id` | Lookup specific documents |
| `aggregate` | Run aggregation pipelines |
| `search_patients` | Cross-practice patient search |
| `get_patient_data` | Get all data for a patient |

**Installation:**
```bash
cd /home/erangross/IntelliCare/mcp-mongodb-server
npm install
```

**Test:**
```bash
node test-connection.js  # Test MongoDB connection
node test-mcp.js         # Test MCP protocol
```

---

### 3. Kimi Configuration Updated

**File:** `~/.config/kimi/config.toml`

**Added MCP servers:**
```toml
[[mcp.servers]]
name = "intellicare-mongodb"
type = "stdio"
command = "node"
args = ["/home/erangross/IntelliCare/mcp-mongodb-server/index.js"]

[[mcp.servers]]
name = "mongodb-memory"
type = "stdio"
command = "node"
args = ["/home/erangross/IntelliCare/mcp-memory-server/index.js"]
```

---

### 4. Claude Code Configuration Created

**File:** `~/.claude.json`

```json
{
  "mcpServers": {
    "mongodb-memory": {
      "type": "stdio",
      "command": "node",
      "args": ["/home/erangross/IntelliCare/mcp-memory-server/index.js"]
    },
    "intellicare-mongodb": {
      "type": "stdio",
      "command": "node",
      "args": ["/home/erangross/IntelliCare/mcp-mongodb-server/index.js"]
    }
  }
}
```

---

## 📋 Usage Examples

### With Kimi

Once Kimi is running, you can use natural language:

```
"List all IntelliCare databases"
"Show me collections in intellicare_practice_yale"
"Search for patient David Wilson"
"Get all medical data for patient 68d16e929b6f26e386161f29"
"Count documents in the patients collection"
```

### With Claude Code

Same natural language queries work with Claude Code through the MCP integration.

---

## 🔧 Testing

### Test API Key
```bash
cd /home/erangross/IntelliCare/apps/backend-api
node scripts/test-anthropic-key.js
```

### Test MCP Server
```bash
cd /home/erangross/IntelliCare/mcp-mongodb-server
node test-mcp.js
```

### Manual MCP Test
```bash
# List tools
claude mcp list

# Test MongoDB connection
claude mcp call intellicare-mongodb list_databases
```

---

## 🗂️ File Locations

| Component | Path |
|-----------|------|
| API Key Storage | `apps/backend-api/.kms/keys/ANTHROPIC_API_KEY.json` |
| API Key Update Script | `apps/backend-api/scripts/update-anthropic-key.js` |
| API Key Test Script | `apps/backend-api/scripts/test-anthropic-key.js` |
| MCP MongoDB Server | `mcp-mongodb-server/` |
| MCP Memory Server | `mcp-memory-server/` |
| Kimi Config | `~/.config/kimi/config.toml` |
| Claude Config | `~/.claude.json` |

---

## 🔐 Security Notes

- All API keys are encrypted at rest in the KMS
- MongoDB access is read-only
- No external network access required
- All MCP communication is local via stdio

---

## 📝 Next Steps

1. **Restart Kimi** to pick up the new MCP configuration
2. **Test MCP tools** with a simple query like "list databases"
3. **Use Claude Code** with the new MCP server for database exploration

---

**Setup completed:** 2026-01-29
