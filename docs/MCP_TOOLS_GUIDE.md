# MCP Tools Complete Guide for IntelliCare Testing

## 🔴 CRITICAL RULES FOR CHROME MCP

### 1. NEVER Open New Tabs Unnecessarily
- Use existing tabs when possible
- Check current tabs with `get_windows_and_tabs` first
- Only open new tab if explicitly needed

### 2. Form Submission Pattern (MUST FOLLOW)
```javascript
// Step 1: Fill the field
mcp__chrome-mcp-stdio__chrome_fill_or_select
  selector: "textarea"
  value: "Your test query"

// Step 2: CRITICAL - Press Enter to submit!
mcp__chrome-mcp-stdio__chrome_keyboard
  keys: "Enter"

// Step 3: Wait for response
sleep 3-5 seconds

// Step 4: Get the content
mcp__chrome-mcp-stdio__chrome_get_web_content
  textContent: true
```

## 📋 MongoDB MCP Tools

### Query Data
```javascript
mcp__MongoDB-IntelliCare__find
  database: "intellicare_practice_yale"  // or other practice
  collection: "hospital_discharge_summaries"
  filter: { patientId: "68d16e929b6f26e386161f29" }
  limit: 10
```

### List Collections
```javascript
mcp__MongoDB-IntelliCare__list-collections
  database: "intellicare_practice_yale"
```

### Count Documents
```javascript
mcp__MongoDB-IntelliCare__count
  database: "intellicare_practice_yale"
  collection: "hospital_discharge_summaries"
  query: {}  // optional filter
```

### Insert Documents
```javascript
mcp__MongoDB-IntelliCare__insert-many
  database: "intellicare_practice_yale"
  collection: "test_collection"
  documents: [{ field: "value" }]
```

### Update Documents
```javascript
mcp__MongoDB-IntelliCare__update-many
  database: "intellicare_practice_yale"
  collection: "patients"
  filter: { _id: "someId" }
  update: { $set: { field: "newValue" } }
```

### Delete Documents
```javascript
mcp__MongoDB-IntelliCare__delete-many
  database: "intellicare_practice_yale"
  collection: "test_collection"
  filter: { field: "value" }
```

## 🌐 Chrome MCP Tools (Complete Reference)

### 1. Navigation & Tab Management

#### Get Current Windows and Tabs
```javascript
mcp__chrome-mcp-stdio__get_windows_and_tabs
// Returns: windowId, tabId, url, title, active status
```

#### Navigate to URL
```javascript
mcp__chrome-mcp-stdio__chrome_navigate
  url: "http://localhost:3000/chat"
  newWindow: false  // Don't create new window
  refresh: false    // Just navigate, don't refresh
```

#### Close Tabs
```javascript
mcp__chrome-mcp-stdio__chrome_close_tabs
  tabIds: [391473344]  // Optional, closes active if not provided
```

### 2. Content Interaction

#### Get Web Content
```javascript
mcp__chrome-mcp-stdio__chrome_get_web_content
  textContent: true     // Get text content
  htmlContent: false    // Get HTML (if true, textContent ignored)
  selector: "div.chat"  // Optional: specific element
```

#### Take Screenshot
```javascript
mcp__chrome-mcp-stdio__chrome_screenshot
  fullPage: true
  storeBase64: true   // To view in Claude
  savePng: false      // Don't save file
```

#### Get Interactive Elements
```javascript
mcp__chrome-mcp-stdio__chrome_get_interactive_elements
  textQuery: "submit"  // Optional: search for specific text
  selector: "button"   // Optional: filter by selector
  includeCoordinates: true
```

### 3. Form Interaction

#### Click Element
```javascript
mcp__chrome-mcp-stdio__chrome_click_element
  selector: "button[type='submit']"  // CSS selector
  // OR
  coordinates: { x: 100, y: 200 }    // Click at coordinates
  waitForNavigation: false  // Don't wait for page load
```

#### Fill Form Field
```javascript
mcp__chrome-mcp-stdio__chrome_fill_or_select
  selector: "input#email"
  value: "test@example.com"
```

#### Keyboard Input
```javascript
mcp__chrome-mcp-stdio__chrome_keyboard
  keys: "Enter"           // Single key
  // OR
  keys: "Ctrl+A,Delete"   // Key sequence
  selector: "textarea"    // Optional: target element
  delay: 100             // Optional: delay between keys (ms)
```

### 4. Browser History & Bookmarks

#### Search History
```javascript
mcp__chrome-mcp-stdio__chrome_history
  text: "intellicare"     // Search term
  startTime: "1 day ago"  // Time range start
  endTime: "now"          // Time range end
  maxResults: 100
  excludeCurrentTabs: true
```

#### Search Bookmarks
```javascript
mcp__chrome-mcp-stdio__chrome_bookmark_search
  query: "medical"
  maxResults: 50
```

### 5. Console & Network

#### Get Console Output
```javascript
mcp__chrome-mcp-stdio__chrome_console
  maxMessages: 100
  includeExceptions: true
```

#### Network Capture (Start/Stop)
```javascript
// Start capturing
mcp__chrome-mcp-stdio__chrome_network_capture_start
  url: "http://localhost:3000"  // Optional

// Stop and get results
mcp__chrome-mcp-stdio__chrome_network_capture_stop
```

## 🔄 Testing Workflow for IntelliCare

### Complete Test Sequence for Medical Data

1. **Clear Cache**
```bash
redis-cli FLUSHALL
```

2. **Check Current Browser State**
```javascript
mcp__chrome-mcp-stdio__get_windows_and_tabs
```

3. **Navigate to Chat (if needed)**
```javascript
mcp__chrome-mcp-stdio__chrome_navigate
  url: "http://localhost:3000/chat"
```

4. **Wait for Page Load**
```bash
sleep 2
```

5. **Enter Query**
```javascript
mcp__chrome-mcp-stdio__chrome_fill_or_select
  selector: "textarea"
  value: "Show me the hospital discharge summary for David Wilson"
```

6. **Submit Query (CRITICAL)**
```javascript
mcp__chrome-mcp-stdio__chrome_keyboard
  keys: "Enter"
```

7. **Wait for Processing**
```bash
sleep 5
```

8. **Check Console for Errors**
```javascript
mcp__chrome-mcp-stdio__chrome_console
```

9. **Get Response Content**
```javascript
mcp__chrome-mcp-stdio__chrome_get_web_content
  textContent: true
```

10. **Take Screenshot for Verification**
```javascript
mcp__chrome-mcp-stdio__chrome_screenshot
  storeBase64: true
  savePng: false
```

## 🐛 Common Issues & Solutions

### Issue: Form doesn't submit
**Solution**: Always use keyboard Enter after filling:
```javascript
mcp__chrome-mcp-stdio__chrome_keyboard
  keys: "Enter"
```

### Issue: Page not loaded
**Solution**: Add sleep between navigation and interaction:
```bash
sleep 2-3
```

### Issue: Element not found
**Solution**: Get interactive elements first to find correct selector:
```javascript
mcp__chrome-mcp-stdio__chrome_get_interactive_elements
  includeCoordinates: true
```

### Issue: Wrong tab active
**Solution**: Check tabs first, don't open new ones:
```javascript
mcp__chrome-mcp-stdio__get_windows_and_tabs
```

## 📊 Database Testing Patterns

### Find Patient with Medical Data
```javascript
// Step 1: Find patients with discharge summaries
mcp__MongoDB-IntelliCare__find
  database: "intellicare_practice_yale"
  collection: "hospital_discharge_summaries"
  limit: 1

// Step 2: Get patient details
mcp__MongoDB-IntelliCare__find
  database: "intellicare_practice_yale"
  collection: "patients"
  filter: { _id: "patientIdFromStep1" }
```

### Verify Data Exists
```javascript
// Count documents for patient
mcp__MongoDB-IntelliCare__count
  database: "intellicare_practice_yale"
  collection: "hospital_discharge_summaries"
  query: { patientId: "68d16e929b6f26e386161f29" }
```

## 🎯 Key Patient for Testing

**David Wilson**
- Patient ID: `68d16e929b6f26e386161f29`
- Database: `intellicare_practice_yale`
- Has extensive medical data including:
  - Hospital discharge summaries
  - Lab results
  - Medications
  - Vital signs
  - Medical history

## 📝 Backend Log Monitoring

```bash
# Watch for function executions
tail -f logs/server.log | grep -E "searchPatientsByName|getHospitalDischargeSummaries"

# Watch for errors
tail -f logs/server-errors.log

# Check SecureDataAccess queries
tail -f logs/server.log | grep SecureDataAccess

# Monitor Claude API calls
tail -f logs/server.log | grep "Claude"
```

## 🚀 Quick Test Commands

### Test Patient Search to Hospital Discharge
```javascript
// 1. Fill search query
mcp__chrome-mcp-stdio__chrome_fill_or_select
  selector: "textarea"
  value: "Show me the hospital discharge summary for David Wilson"

// 2. Submit (MUST DO!)
mcp__chrome-mcp-stdio__chrome_keyboard
  keys: "Enter"

// 3. Wait
sleep 5

// 4. Get results
mcp__chrome-mcp-stdio__chrome_get_web_content
  textContent: true
```

## ⚠️ REMEMBER
1. ALWAYS press Enter after filling forms
2. NEVER skip the sleep/wait periods
3. USE existing tabs, don't open new ones
4. CHECK current state before actions
5. TAKE screenshots for debugging