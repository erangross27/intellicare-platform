# AI Insights Card Integration Guide

## Overview
The new AI Insights architecture replaces the 31+ grid display with a cleaner, ChatGPT-style interface:
- **AI Insights Card**: Shows 8 summary cards when user requests general medical data
- **Single Category Card**: Shows detailed data table when user requests specific category

## Frontend Components

### 1. AIInsightsCard (`apps/frontend-vite/src/components/medical/AIInsightsCard.js`)
Displays 8 clickable insight categories:
- Clinical Decision Support
- Quality Metrics
- Medication Optimization
- Trending Analysis
- Follow-up Intelligence
- Patient-Specific Care Plan
- Patient Education
- Risk Stratification

**Usage**: Auto-renders when backend sends `displayType: 'aiInsights'`

### 2. SingleCategoryCard (`apps/frontend-vite/src/components/medical/SingleCategoryCard.js`)
Displays detailed data for a specific medical category with:
- Category header with icon
- Quick stats grid
- Data table with columns
- Footer hints

**Usage**: Auto-renders when backend sends `displayType: 'singleCategory'`

## Backend Integration

### When to Send AI Insights
User asks for **GENERAL** medical data:
- "Show me Amanda White's medical data"
- "What's this patient's health status?"
- "Analyze this patient"

**Response Format**:
```javascript
{
  data: {
    message: "I've analyzed Amanda White's complete medical records. Here's a comprehensive AI-generated clinical overview with actionable insights:",
    displayType: 'aiInsights',
    // No displayData needed - component has built-in data
  }
}
```

### When to Send Single Category
User asks for **SPECIFIC** category:
- "Show me Amanda White's cardiology data"
- "Show me lab results"
- "What medications is this patient on?"

**Response Format**:
```javascript
{
  data: {
    message: "Here's Amanda White's cardiology consultation data. I found 3 specialist visits for atrial fibrillation management:",
    displayType: 'singleCategory',
    displayData: {
      name: 'cardiology',  // Required: category identifier
      subtitle: 'Specialist care • Atrial fibrillation management',  // Optional
      itemCount: 3,  // Optional: badge count
      stats: [  // Optional: quick stats grid
        { label: 'Total Visits', value: '3' },
        { label: 'Last Visit', value: 'Nov 28' },
        { label: 'Primary Condition', value: 'Atrial Fibrillation' },
        { label: 'Next Follow-up', value: 'Dec 5' }
      ],
      columns: ['Date', 'Chief Complaint', 'Assessment', 'Plan', 'Cardiologist'],  // Required for table
      data: [  // Required: table rows
        {
          'Date': '11/28/2024',
          'Chief Complaint': 'Palpitations, irregular heartbeat',
          'Assessment': 'Paroxysmal AF, rate-controlled',
          'Plan': 'Medications: Metoprolol 25mg BID, Warfarin 5mg daily',
          'Cardiologist': 'Dr. Michael Chen'
        },
        {
          'Date': '10/15/2024',
          'Chief Complaint': 'Follow-up AF, medication review',
          'Assessment': 'Improved symptom control, INR therapeutic',
          'Plan': 'Continue current medications, monitor INR weekly',
          'Cardiologist': 'Dr. Michael Chen'
        }
      ]
    }
  }
}
```

## Category Name Mapping

Supported category identifiers:
- `cardiology` → Cardiology Consultations ❤️
- `lab_results` → Laboratory Results 🧪
- `medications` → Medications 💊
- `procedures` → Procedures 🔬
- `radiology` → Radiology 📸
- `vital_signs` → Vital Signs 📊

## Implementation Steps

### Step 1: Update Function Selection Logic
Modify the function selection service to detect general vs specific queries:

```javascript
// In claudeTwoStageSelector.js or similar
function determineDisplayType(userMessage) {
  const generalPatterns = [
    /show me .*'s medical data/i,
    /analyze .*patient/i,
    /health status/i,
    /medical overview/i
  ];

  const specificPatterns = {
    cardiology: /cardiology|heart|cardiac/i,
    lab_results: /lab.*results?|blood.*test/i,
    medications: /medications?|drugs?|prescriptions?/i,
    procedures: /procedures?|operations?/i,
    radiology: /radiology|imaging|x-ray|mri|ct/i,
    vital_signs: /vital.*signs?|blood.*pressure|temperature/i
  };

  // Check if general request
  for (const pattern of generalPatterns) {
    if (pattern.test(userMessage)) {
      return { type: 'aiInsights' };
    }
  }

  // Check if specific category
  for (const [category, pattern] of Object.entries(specificPatterns)) {
    if (pattern.test(userMessage)) {
      return { type: 'singleCategory', category };
    }
  }

  return { type: 'default' };
}
```

### Step 2: Update Data Retrieval Function
Modify the medical data retrieval function to return appropriate format:

```javascript
// In agentFunctions.js or similar
async function getMedicalData(params, context) {
  const { patientId, category } = params;
  const displayType = determineDisplayType(context.userMessage);

  if (displayType.type === 'aiInsights') {
    // Return AI insights format
    return {
      message: `I've analyzed ${patientName}'s complete medical records...`,
      displayType: 'aiInsights'
    };
  } else if (displayType.type === 'singleCategory') {
    // Fetch specific category data
    const categoryData = await fetchCategoryData(patientId, displayType.category);

    return {
      message: `Here's ${patientName}'s ${displayType.category} data...`,
      displayType: 'singleCategory',
      displayData: {
        name: displayType.category,
        subtitle: categoryData.subtitle,
        itemCount: categoryData.items.length,
        stats: categoryData.stats,
        columns: categoryData.columns,
        data: categoryData.items
      }
    };
  } else {
    // Fallback to old multi-grid display
    return existingMultiGridLogic(patientId);
  }
}
```

### Step 3: Update Response Builder
Ensure the response builder preserves displayType:

```javascript
// In agentServiceV4.js or similar
function buildResponse(result, context) {
  return {
    success: true,
    data: {
      message: result.message,
      displayType: result.displayType || 'default',
      displayData: result.displayData || null,
      actionTaken: context.functionName,
      actionResult: result
    }
  };
}
```

## Testing

### Test AI Insights Display
```bash
# Send message via WebGUI:
"Show me Amanda White's medical data"

# Expected: AIInsightsCard appears with 8 clickable categories
# Clicking a category expands to show detailed recommendations
```

### Test Single Category Display
```bash
# Send message via WebGUI:
"Show me Amanda White's cardiology data"

# Expected: SingleCategoryCard appears with:
# - Header: ❤️ Cardiology Consultations (3 Visits)
# - Stats: Total Visits, Last Visit, Primary Condition, Next Follow-up
# - Table: Date, Chief Complaint, Assessment, Plan, Cardiologist
```

## Migration Notes

### Current Behavior (OLD)
- User asks: "Show me medical data"
- Backend returns: 31+ grids in `categoryGrids` array
- Frontend shows: All grids at once (cluttered)

### New Behavior
- User asks: "Show me medical data"
- Backend returns: `displayType: 'aiInsights'`
- Frontend shows: 8 clean summary cards
- User clicks card: Expands to show details

### Backward Compatibility
The old multi-grid display (`categoryGrids`) still works. The new cards are additive:
- If `displayType === 'aiInsights'` → Show AI Insights Card
- If `displayType === 'singleCategory'` → Show Single Category Card
- If `categoryGrids` array → Show old multi-grid display (fallback)

## Benefits

1. **Cleaner UI**: 8 cards vs 31+ grids
2. **Progressive Disclosure**: Click to see details
3. **Better UX**: ChatGPT-style interface
4. **Faster Loading**: Only show what's needed
5. **Mobile Friendly**: Cards stack better than grids

## Next Steps

1. ✅ Frontend components created
2. ✅ Message.js updated to render new cards
3. ⏳ Backend logic to determine displayType
4. ⏳ Function selection to detect general vs specific queries
5. ⏳ Data retrieval functions to format responses correctly
