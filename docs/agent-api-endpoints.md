# IntelliCare AI Agent API Endpoints

## Medical History Management APIs

These endpoints are designed for both web UI and AI agent access. All endpoints support voice command integration through the future LangChain + OpenAI Function Calling architecture.

### Patient History Operations

#### Get Patient Medical History
```
GET /api/patients/:id/history
```
Returns all active (non-deleted) medical history entries for a patient.

**Agent Use Case**: "Show me patient's medical history"

#### Get Deleted History Entries
```
GET /api/patients/:id/history/deleted
```
Returns soft-deleted medical history entries.

**Agent Use Case**: "Show me recently deleted entries for this patient"

#### Add New History Entry
```
POST /api/patients/:id/history
```
**Body**:
```json
{
  "date": "2024-01-15",
  "diagnosis": "Follow-up visit",
  "symptoms": "No symptoms reported",
  "treatment": "Continue current medication",
  "notes": "Patient feeling well"
}
```

**Agent Use Case**: "Add new medical history entry: diagnosis - follow-up visit, symptoms - none, treatment - continue medication"

#### Edit History Entry
```
PUT /api/patients/:id/history/:entryId
```
**Body**:
```json
{
  "date": "2024-01-15",
  "diagnosis": "Updated diagnosis",
  "symptoms": "Updated symptoms",
  "treatment": "Updated treatment",
  "notes": "Updated notes"
}
```

**Agent Use Case**: "Edit the latest entry: change diagnosis to 'routine checkup'"

#### Soft Delete History Entry
```
DELETE /api/patients/:id/history/:entryId
```
**Body**:
```json
{
  "deletedBy": "agent"
}
```

**Agent Use Case**: "Delete the entry about the lab results from last week"

#### Restore Deleted Entry
```
PUT /api/patients/:id/history/:entryId/restore
```

**Agent Use Case**: "Restore the entry I just deleted"

#### Permanent Delete
```
DELETE /api/patients/:id/history/:entryId/permanent
```

**Agent Use Case**: "Permanently delete this old entry"

### Voice Command Examples

#### Hebrew Commands
- "הוסף רשומה רפואית חדשה: אבחנה - ביקור מעקב, תסמינים - אין"
- "ערוך את הרשומה האחרונה: שנה את האבחנה ל'בדיקה שגרתית'"
- "מחק את הרשומה על תוצאות המעבדה מהשבוע שעבר"
- "הצג את ההיסטוריה הרפואית של המטופל"

#### English Commands
- "Add new medical history entry: diagnosis - follow-up visit, symptoms - none"
- "Edit the latest entry: change diagnosis to 'routine checkup'"
- "Delete the entry about lab results from last week"
- "Show me the patient's medical history"

### Response Format

All endpoints return standardized responses:

**Success Response**:
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { /* relevant data */ }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Error message description"
}
```

### Agent Integration Notes

1. **Authentication**: Future agent implementation should include proper authentication headers
2. **Error Handling**: Agent should parse `success` field and handle errors gracefully
3. **Data Validation**: All required fields must be provided (date, diagnosis are required)
4. **Multilingual Support**: Agent can operate in Hebrew or English based on user preference
5. **Context Awareness**: Agent should maintain patient context throughout conversation

### Future Agent Architecture

```
Voice Input (Hebrew/English) 
    ↓
OpenAI Whisper (Speech-to-Text)
    ↓
LangChain Agent with Function Calling
    ↓
IntelliCare API Endpoints
    ↓
Database Operations
    ↓
Response to User (Voice/Text)
```

### Security Considerations

- All medical data operations must be logged for HIPAA compliance
- Agent actions should include audit trail with timestamps
- Patient data access should be role-based
- Voice commands should be validated before execution

### Testing Agent Integration

Use these curl commands to test agent-compatible endpoints:

```bash
# Add new entry (agent simulation)
curl -X POST http://localhost:5000/api/patients/PATIENT_ID/history \
  -H "Content-Type: application/json" \
  -d '{"date":"2024-01-15","diagnosis":"Agent test","symptoms":"None","treatment":"None"}'

# Edit entry (agent simulation)  
curl -X PUT http://localhost:5000/api/patients/PATIENT_ID/history/ENTRY_ID \
  -H "Content-Type: application/json" \
  -d '{"diagnosis":"Updated by agent"}'

# Delete entry (agent simulation)
curl -X DELETE http://localhost:5000/api/patients/PATIENT_ID/history/ENTRY_ID \
  -H "Content-Type: application/json" \
  -d '{"deletedBy":"agent"}'
```
