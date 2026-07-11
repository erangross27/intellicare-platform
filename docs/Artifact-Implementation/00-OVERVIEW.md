# Artifact-Based Medical Document Viewer - Overview

## 🎯 Project Goal

Replace ALL grid-based data display (850+ collections) with a beautiful, readable artifact-style document viewer inspired by Claude's Artifacts feature.

## 🏗️ Architecture Change

### Before (Current State)
```
Doctor asks for data → Grid component loads → Shows table with many columns
```
**Problems:**
- Grids have 8+ columns
- Text is cramped and hard to read
- Not suitable for narrative AI insights
- Not professional looking

### After (Target State)
```
Doctor asks for data → Artifact panel opens (right 50% of screen) → Shows beautifully formatted document
```
**Benefits:**
- Natural reading experience
- Professional medical document formatting
- Perfect for AI-generated insights
- Print-ready
- Scalable to 850+ collections

## 📐 Three-Level Navigation

### Level 1: Category List
**Trigger**: "Show me medical data"
**Display**: Vertical list of 30-40 categories with document counts
**Example**:
- 💊 Medications (12)
- 🔬 Lab Results (45)
- 📊 Vital Signs (120)

### Level 2: Document List
**Trigger**: "Show me medications" or click category
**Display**: Chronological list of documents (newest first)
**Example**:
- 📄 Jan 20, 2025 - Current medications ⭐
- 📄 Jan 15, 2025 - Added Dupilumab
- 📄 Dec 10, 2024 - Medication changes

### Level 3: Document Detail
**Trigger**: Click specific document
**Display**: Full beautifully formatted medical document
**Features**: Scrollable, printable, back button

## 🖥️ Screen Layout

```
┌─────────┬──────────────────┬──────────────────────┐
│  Left   │   Chat Area      │   Artifact Panel     │
│  Nav    │   (50% width)    │   (50% width)        │
│ Sidebar │                  │                      │
│ (stays) │  Conversation    │  Medical Document    │
│         │  with AI         │  Display             │
│         │                  │                      │
│         │                  │  Level 1, 2, or 3    │
│  Right  │                  │                      │
│ Context │                  │                      │
│(collapses)                │                      │
└─────────┴──────────────────┴──────────────────────┘
```

**Behavior**:
- Left sidebar: Always visible (navigation)
- Right sidebar: Auto-collapses when artifact opens
- Chat: Left 50% (maintains conversation context)
- Artifact: Right 50% (dedicated to data display)

## 🧩 Component Architecture

### Core Components (7 total)
1. **ArtifactPanel.jsx** - Main wrapper, manages open/close state
2. **CategoryListView.jsx** - Shows category list (Level 1)
3. **DocumentListView.jsx** - Shows document list (Level 2)
4. **DocumentListItem.jsx** - Single item in document list
5. **DocumentDetailView.jsx** - Shows full document (Level 3)
6. **DocumentRenderer.jsx** - Routes to correct template
7. **Navigation logic** - Handles transitions between levels

### Document Templates (~15 templates)
Reusable templates for different data types:
1. **MedicationDocument** - For medications
2. **LabResultsDocument** - For lab results
3. **VitalSignsDocument** - For vital signs
4. **AIInsightsDocument** - For AI recommendations
5. **DiagnosisDocument** - For diagnoses
6. **ProcedureDocument** - For procedures
7. **TimelineDocument** - For hospital course
8. **TrendingDocument** - For trending analysis
9. **QualityMetricsDocument** - For quality metrics
10. **AllergyDocument** - For allergies
11. **ImagingDocument** - For imaging reports
12. **ComparisonDocument** - For medication optimization
13. **TableDocument** - Generic table template
14. **NarrativeDocument** - Generic text template
15. **SummaryDocument** - Generic summary template

**Key Insight**: 15 templates can handle 850+ collections through smart mapping!

## 🔄 Data Flow

### Backend API (3 new endpoints)

1. **GET /api/agent/patient/:patientId/categories**
   - Returns: List of available categories with counts
   - Example: `{ categories: [{ name: "medications", count: 12 }] }`

2. **GET /api/agent/patient/:patientId/category/:categoryName**
   - Returns: List of documents in category (sorted newest first)
   - Example: `{ documents: [{ date: "2025-01-20", title: "..." }] }`

3. **GET /api/agent/patient/:patientId/category/:categoryName/document/:documentId**
   - Returns: Full document data for rendering
   - Example: `{ data: { medications: [...] } }`

### Frontend State

```javascript
{
  isOpen: boolean,           // Is artifact panel open?
  level: string,             // 'categories' | 'documents' | 'detail'
  selectedCategory: string,  // e.g., 'medications'
  selectedDocument: object,  // Full document data
  documents: array,          // List of documents in category
  categories: array          // List of available categories
}
```

## 📋 Implementation Phases

### Phase 1: Backend API (3-4 days, 8 tasks)
Create 3 new endpoints, add sorting, counting, and testing

### Phase 2: Frontend Core (3-4 days, 10 tasks)
Create 7 core components, navigation logic, animations

### Phase 3: Document Templates (5-6 days, 15 tasks)
Create 15 reusable document templates with beautiful formatting

### Phase 4: Integration (3-4 days, 6 tasks)
Map collections to templates, replace grids, connect chat

### Phase 5: Polish & Testing (2-3 days, 5 tasks)
Loading states, errors, print/download, responsive design

**Total: 44 tasks over 15-17 days**

## ✨ Key Design Principles

### 1. Readability First
- Beautiful typography (serif headings, sans-serif body)
- Generous spacing
- Clear visual hierarchy
- Professional medical document look

### 2. Progressive Disclosure
- Start broad (categories)
- Narrow down (documents in category)
- Deep dive (full document detail)
- Never overwhelm with all data at once

### 3. Chronological by Default
- Always show newest first
- Clear date indicators
- Star (⭐) for most recent

### 4. Template Reusability
- 15 base templates cover 850+ collections
- Smart mapping config
- Easy to add new templates
- Easy to customize existing ones

### 5. Print-Ready
- Every document can be printed
- Professional formatting maintained
- Page breaks where appropriate
- Headers/footers for context

## 🎨 Visual Design

### Typography
- **Headers**: Serif font (Georgia, Times New Roman)
- **Body**: Sans-serif (Arial, Helvetica)
- **Code/Data**: Monospace (Courier, Monaco)
- **Size hierarchy**: H1 > H2 > H3 > Body > Small

### Colors
- **Primary**: Blue (#0066CC) for links
- **Success**: Green (#28A745) for checkmarks
- **Warning**: Orange (#FFA500) for warnings
- **Danger**: Red (#DC3545) for alerts
- **Neutral**: Gray (#6C757D) for secondary text

### Spacing
- **Section spacing**: 2rem between major sections
- **Paragraph spacing**: 1rem between paragraphs
- **Line height**: 1.6 for readability
- **Margins**: Generous (2rem on all sides)

### Visual Indicators
- ✅ Success / Completed / Normal
- ❌ Failed / Contraindicated / Abnormal
- ⚠️ Warning / Caution / Borderline
- 🔴 Critical / Immediate attention
- 🟡 Important / Review soon
- 🟢 Good / Optimal / Within range
- ⭐ Most recent / Featured
- 📄 Document / Record
- → Arrow / Navigate / See more

## 🎯 Success Metrics

### Functionality
- ✅ All 30-40 collections accessible
- ✅ Multiple documents per category supported
- ✅ Newest documents shown first
- ✅ Beautiful, readable formatting
- ✅ Print-ready documents

### Performance
- ✅ Category list: <200ms load time
- ✅ Document list: <500ms load time
- ✅ Document detail: <500ms load time
- ✅ Smooth animations: 60fps

### User Experience
- ✅ Intuitive 3-level navigation
- ✅ Clear visual hierarchy
- ✅ Mobile responsive
- ✅ Keyboard accessible
- ✅ Screen reader compatible

## 📚 Technical Stack

### Frontend
- **Framework**: React (existing)
- **Build Tool**: Vite (existing)
- **Styling**: CSS Modules or Tailwind
- **Animations**: CSS transitions + Framer Motion (optional)
- **State**: React hooks (useState, useEffect)

### Backend
- **Framework**: Express.js (existing)
- **Database**: MongoDB (existing)
- **Security**: SecureDataAccess (existing)
- **Authentication**: Existing auth middleware

### Infrastructure
- **No new dependencies** - uses existing stack
- **Reuses existing APIs** - just adds 3 new endpoints
- **Integrates with chat** - existing chat infrastructure

## 🚀 Future Enhancements

After initial implementation:
- Search within documents
- Filter by date range
- Compare documents side-by-side
- Export to PDF with custom formatting
- Bookmark favorite documents
- Share with other providers
- Annotations and highlights
- Version history and changes

## 📖 Document References

- **Task Details**: See numbered task files (01-05)
- **Component Structure**: See COMPONENT-STRUCTURE.md
- **Data Flow**: See DATA-FLOW.md
- **Template Mapping**: See TEMPLATE-MAPPING.md
- **Progress Tracking**: See CHECKPOINT.md

---

**Created**: January 2025
**Estimated Completion**: 15-17 days from start
**Status**: Planning complete, ready to implement
