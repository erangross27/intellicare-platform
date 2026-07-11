#!/usr/bin/env node

/**
 * Complete Task File Generator for Medical Grid System
 * Generates task files for all 184 GET functions
 */

const fs = require('fs');
const path = require('path');

// Import the complete function list
const { getFunctions } = require('./configs/ALL_GET_FUNCTIONS.js');

// Column templates for different data types
const columnTemplates = {
  date: { type: 'date', width: '120px', sortable: true, filterable: true, format: 'MM/DD/YYYY' },
  time: { type: 'time', width: '100px', sortable: true, filterable: true, format: 'HH:MM AM/PM' },
  datetime: { type: 'datetime', width: '180px', sortable: true, filterable: true, format: 'MM/DD/YYYY HH:MM' },
  string: { type: 'string', width: '200px', sortable: true, filterable: true, format: 'Text' },
  number: { type: 'number', width: '100px', sortable: true, filterable: false, format: 'Number' },
  enum: { type: 'enum', width: '120px', sortable: true, filterable: true, format: 'Dropdown' },
  boolean: { type: 'boolean', width: '80px', sortable: true, filterable: true, format: 'Yes/No' },
  text: { type: 'string', width: '300px', sortable: false, filterable: true, format: 'Multi-line' },
  badge: { type: 'enum', width: '120px', sortable: true, filterable: true, format: 'Status Badge' },
  currency: { type: 'number', width: '120px', sortable: true, filterable: false, format: 'Currency' },
  percentage: { type: 'number', width: '100px', sortable: true, filterable: false, format: 'Percentage' }
};

// Generate specific columns based on function name and category
function generateColumns(func) {
  const columns = [];
  const { name, category, collection } = func;

  // Always include patient name first (except for some aggregate reports)
  if (!name.includes('Summary') && !name.includes('Statistics')) {
    columns.push({ id: 'patientName', display: 'Patient Name', ...columnTemplates.string });
  }

  // Category-specific columns
  if (category === 'Core Medical Records') {
    if (name === 'getAppointments') {
      columns.push(
        { id: 'appointmentDate', display: 'Date', ...columnTemplates.date },
        { id: 'appointmentTime', display: 'Time', ...columnTemplates.time },
        { id: 'providerName', display: 'Provider', ...columnTemplates.string },
        { id: 'department', display: 'Department', ...columnTemplates.string },
        { id: 'appointmentType', display: 'Type', ...columnTemplates.enum },
        { id: 'status', display: 'Status', ...columnTemplates.badge },
        { id: 'reason', display: 'Reason', ...columnTemplates.text }
      );
    } else if (name === 'getMedications') {
      columns.push(
        { id: 'medicationName', display: 'Medication', ...columnTemplates.string, width: '250px' },
        { id: 'dosage', display: 'Dosage', ...columnTemplates.string },
        { id: 'frequency', display: 'Frequency', ...columnTemplates.string },
        { id: 'route', display: 'Route', ...columnTemplates.enum },
        { id: 'startDate', display: 'Start Date', ...columnTemplates.date },
        { id: 'endDate', display: 'End Date', ...columnTemplates.date },
        { id: 'prescriber', display: 'Prescriber', ...columnTemplates.string },
        { id: 'status', display: 'Status', ...columnTemplates.badge }
      );
    } else if (name === 'getAllergies') {
      columns.push(
        { id: 'allergen', display: 'Allergen', ...columnTemplates.string, width: '250px' },
        { id: 'category', display: 'Category', ...columnTemplates.enum },
        { id: 'severity', display: 'Severity', ...columnTemplates.badge },
        { id: 'reaction', display: 'Reaction', ...columnTemplates.text },
        { id: 'onsetDate', display: 'Onset Date', ...columnTemplates.date },
        { id: 'verificationStatus', display: 'Verified', ...columnTemplates.badge }
      );
    } else if (name.includes('Lab') || name === 'getLabResults') {
      columns.push(
        { id: 'testName', display: 'Test Name', ...columnTemplates.string },
        { id: 'result', display: 'Result', ...columnTemplates.string },
        { id: 'referenceRange', display: 'Reference Range', ...columnTemplates.string },
        { id: 'status', display: 'Status', ...columnTemplates.badge },
        { id: 'collectionDate', display: 'Collection Date', ...columnTemplates.datetime },
        { id: 'resultDate', display: 'Result Date', ...columnTemplates.datetime }
      );
    } else if (name.includes('Vital')) {
      columns.push(
        { id: 'bloodPressure', display: 'BP', ...columnTemplates.string, width: '100px' },
        { id: 'heartRate', display: 'HR', ...columnTemplates.number, width: '80px' },
        { id: 'temperature', display: 'Temp', ...columnTemplates.number, width: '80px' },
        { id: 'respiratoryRate', display: 'RR', ...columnTemplates.number, width: '80px' },
        { id: 'oxygenSaturation', display: 'O2 Sat', ...columnTemplates.percentage, width: '80px' },
        { id: 'recordedAt', display: 'Recorded', ...columnTemplates.datetime },
        { id: 'recordedBy', display: 'By', ...columnTemplates.string }
      );
    }
  }

  // Hospital & Emergency specific
  if (category === 'Hospital & Emergency') {
    columns.push(
      { id: 'admissionDate', display: 'Admission Date', ...columnTemplates.datetime },
      { id: 'chiefComplaint', display: 'Chief Complaint', ...columnTemplates.text },
      { id: 'triageLevel', display: 'Triage Level', ...columnTemplates.badge },
      { id: 'attendingPhysician', display: 'Attending', ...columnTemplates.string },
      { id: 'disposition', display: 'Disposition', ...columnTemplates.enum }
    );

    if (name.includes('ICU') || name.includes('Flow')) {
      columns.push(
        { id: 'ventilatorSettings', display: 'Vent Settings', ...columnTemplates.text },
        { id: 'vasopressors', display: 'Vasopressors', ...columnTemplates.text },
        { id: 'sedation', display: 'Sedation', ...columnTemplates.text }
      );
    }
  }

  // Surgical & Operative specific
  if (category === 'Surgical & Operative') {
    columns.push(
      { id: 'procedureName', display: 'Procedure', ...columnTemplates.string, width: '250px' },
      { id: 'surgeonName', display: 'Surgeon', ...columnTemplates.string },
      { id: 'operatingRoom', display: 'OR', ...columnTemplates.string, width: '80px' },
      { id: 'duration', display: 'Duration', ...columnTemplates.string, width: '100px' },
      { id: 'complications', display: 'Complications', ...columnTemplates.text }
    );

    if (name.includes('Anesthesia')) {
      columns.push(
        { id: 'anesthesiaType', display: 'Type', ...columnTemplates.enum },
        { id: 'anesthesiologist', display: 'Anesthesiologist', ...columnTemplates.string },
        { id: 'asaScore', display: 'ASA Score', ...columnTemplates.enum, width: '100px' }
      );
    }
  }

  // Cardiology specific
  if (category === 'Cardiology') {
    if (name.includes('ECG') || name.includes('EKG')) {
      columns.push(
        { id: 'rhythm', display: 'Rhythm', ...columnTemplates.string },
        { id: 'rate', display: 'Rate', ...columnTemplates.number },
        { id: 'prInterval', display: 'PR', ...columnTemplates.number, width: '80px' },
        { id: 'qrsComplex', display: 'QRS', ...columnTemplates.number, width: '80px' },
        { id: 'qtInterval', display: 'QT', ...columnTemplates.number, width: '80px' },
        { id: 'interpretation', display: 'Interpretation', ...columnTemplates.text }
      );
    } else if (name.includes('Echo')) {
      columns.push(
        { id: 'ejectionFraction', display: 'EF %', ...columnTemplates.percentage },
        { id: 'wallMotion', display: 'Wall Motion', ...columnTemplates.text },
        { id: 'valveFunction', display: 'Valves', ...columnTemplates.text },
        { id: 'findings', display: 'Findings', ...columnTemplates.text }
      );
    } else {
      columns.push(
        { id: 'testDate', display: 'Test Date', ...columnTemplates.date },
        { id: 'cardiologist', display: 'Cardiologist', ...columnTemplates.string },
        { id: 'findings', display: 'Findings', ...columnTemplates.text },
        { id: 'recommendations', display: 'Recommendations', ...columnTemplates.text }
      );
    }
  }

  // Imaging & Radiology specific
  if (category === 'Imaging') {
    columns.push(
      { id: 'studyType', display: 'Study Type', ...columnTemplates.string },
      { id: 'bodyPart', display: 'Body Part', ...columnTemplates.string },
      { id: 'technique', display: 'Technique', ...columnTemplates.string },
      { id: 'contrast', display: 'Contrast', ...columnTemplates.boolean },
      { id: 'findings', display: 'Findings', ...columnTemplates.text },
      { id: 'impression', display: 'Impression', ...columnTemplates.text },
      { id: 'radiologist', display: 'Radiologist', ...columnTemplates.string },
      { id: 'studyDate', display: 'Study Date', ...columnTemplates.datetime }
    );
  }

  // Pediatrics specific
  if (category === 'Pediatrics') {
    columns.push(
      { id: 'age', display: 'Age', ...columnTemplates.string, width: '100px' },
      { id: 'weight', display: 'Weight', ...columnTemplates.string, width: '100px' },
      { id: 'height', display: 'Height', ...columnTemplates.string, width: '100px' }
    );

    if (name.includes('Growth')) {
      columns.push(
        { id: 'percentileWeight', display: 'Weight %ile', ...columnTemplates.percentage },
        { id: 'percentileHeight', display: 'Height %ile', ...columnTemplates.percentage },
        { id: 'bmi', display: 'BMI', ...columnTemplates.number },
        { id: 'percentileBMI', display: 'BMI %ile', ...columnTemplates.percentage }
      );
    } else if (name.includes('Vaccination')) {
      columns.push(
        { id: 'vaccineName', display: 'Vaccine', ...columnTemplates.string },
        { id: 'doseNumber', display: 'Dose #', ...columnTemplates.number, width: '80px' },
        { id: 'administeredDate', display: 'Date Given', ...columnTemplates.date },
        { id: 'nextDueDate', display: 'Next Due', ...columnTemplates.date }
      );
    }
  }

  // Add common ending columns if not already present
  if (!columns.find(c => c.id.includes('Date') || c.id.includes('date'))) {
    columns.push({ id: 'date', display: 'Date', ...columnTemplates.date });
  }

  if (!columns.find(c => c.id === 'status')) {
    columns.push({ id: 'status', display: 'Status', ...columnTemplates.badge });
  }

  if (!columns.find(c => c.id === 'provider' || c.id.includes('Provider') || c.id.includes('physician'))) {
    columns.push({ id: 'provider', display: 'Provider', ...columnTemplates.string });
  }

  return columns;
}

// Generate task file content with rich details
function generateTaskContent(func) {
  const columns = generateColumns(func);

  // Determine specific features based on category
  const hasRealTimeUpdates = func.priority === 'CRITICAL' || func.category === 'Hospital & Emergency';
  const hasAuditTrail = func.priority === 'CRITICAL' || func.name.includes('Medication') || func.name.includes('Allergy');
  const hasExportCompliance = func.category === 'Core Medical Records' || func.category === 'Diagnostic';

  return `# Task ${String(func.id).padStart(3, '0')}: ${func.name} Grid Implementation

## Function Details
- **Function Name**: ${func.name}
- **Category**: ${func.category}
- **Collection**: ${func.collection}
- **Priority**: ${func.priority}
- **Estimated Patients Affected**: ${func.priority === 'CRITICAL' ? '100%' : func.priority === 'HIGH' ? '80%' : func.priority === 'MEDIUM' ? '50%' : '20%'}

## Grid Column Configuration

### Primary Columns
| Column ID | Display Name | Data Type | Width | Sortable | Filterable | Format |
|-----------|-------------|-----------|--------|----------|------------|---------|
${columns.map(col =>
  `| ${col.id} | ${col.display} | ${col.type} | ${col.width} | ${col.sortable ? '✅' : '❌'} | ${col.filterable ? '✅' : '❌'} | ${col.format} |`
).join('\n')}

### Hidden Columns (for actions/linking)
- ${func.collection}Id (ObjectId) - Primary key
- patientId (ObjectId) - Link to patient
- createdBy (ObjectId) - User who created
- createdAt (DateTime) - Creation timestamp
- lastModifiedBy (ObjectId) - Last modifier
- lastModifiedAt (DateTime) - Last modification
- practiceId (String) - Multi-tenant isolation
- isDeleted (Boolean) - Soft delete flag

## Data Formatting Rules

### Standard Formatters
\`\`\`javascript
const formatters = {
  // Date/Time formatting
  date: (value) => moment(value).format('MM/DD/YYYY'),
  time: (value) => moment(value).format('hh:mm A'),
  datetime: (value) => moment(value).format('MM/DD/YYYY hh:mm A'),

  // Status badges with colors
  status: (value) => ({
    text: value,
    color: getStatusColor(value),
    icon: getStatusIcon(value)
  }),

  // Medical-specific formatting
  ${func.category === 'Diagnostic' ? `labResult: (value, referenceRange) => ({
    value: value,
    isAbnormal: isOutOfRange(value, referenceRange),
    flag: getAbnormalFlag(value, referenceRange)
  }),` : ''}

  ${func.category === 'Cardiology' ? `bloodPressure: (systolic, diastolic) => \`\${systolic}/\${diastolic}\`,
  heartRate: (value) => \`\${value} bpm\`,` : ''}

  ${func.category === 'Pediatrics' ? `percentile: (value) => \`\${value}%ile\`,
  weight: (value, unit) => \`\${value} \${unit || 'kg'}\`,` : ''}

  // Null handling
  nullValue: () => '--'
};
\`\`\`

${hasRealTimeUpdates ? `### Real-Time Updates
- WebSocket event: \`${func.collection}:update\`
- Update frequency: Every change
- Highlight changed cells for 3 seconds` : ''}

${hasAuditTrail ? `### Audit Trail Requirements
- Track all view, edit, export actions
- Store user, timestamp, IP address
- Maintain complete change history
- Comply with HIPAA audit requirements` : ''}

## Filter Options

### Quick Filters
${func.category === 'Core Medical Records' ? `- Today
- This Week
- This Month
- Last 90 Days
- Active Only
- My Patients` : ''}
${func.category === 'Hospital & Emergency' ? `- Current Admissions
- Last 24 Hours
- Last 48 Hours
- Critical Only
- My Unit
- Pending Discharge` : ''}
${func.category === 'Diagnostic' ? `- Abnormal Results
- Pending Results
- Today's Results
- This Week
- Critical Values
- My Orders` : ''}
- Date Range (Custom)
- Text Search (All fields)

### Advanced Filters
- Multiple ${columns[0]?.display || 'Field'} Selection
- ${columns[1]?.display || 'Status'} Selection
- Provider/Department Filter
- Date Range Picker
- Severity/Priority Level
${func.priority === 'CRITICAL' ? '- Alert Status Filter' : ''}
${func.category === 'Diagnostic' ? '- Result Range Filter' : ''}

### Saved Filters
- Allow users to save filter combinations
- Quick access to frequently used filters
- Share filters with team members

## Row Actions

### Single Row Actions
- 👁️ View Details (Modal or side panel)
- ✏️ Edit Record (Based on permissions)
- 📄 Export to PDF
- 🖨️ Print Record
- 📧 Email Record
- 🔗 Share Link
- 📝 Add Note/Comment
- 📎 Attach Document
- 🕐 View History/Audit Trail
${func.priority === 'CRITICAL' ? '- 🚨 Mark as Critical' : ''}
${func.category === 'Diagnostic' ? '- 📊 View Trends' : ''}

### Bulk Actions (Multiple Selection)
- ☑️ Select All / Select Page
- 📥 Export Selected (CSV/Excel/PDF)
- 🖨️ Print Multiple
- 📧 Email Multiple
- 🗂️ Archive Selected
- 🏷️ Tag Multiple
${func.priority !== 'CRITICAL' ? '- 🗑️ Delete Multiple (Soft)' : ''}

### Context Menu (Right-click)
- Copy Cell Value
- Copy Row
- Open in New Tab
- View Related Records

## Performance Optimization

### Data Loading Strategy
- **Initial Load**: First ${func.priority === 'CRITICAL' ? '50' : '100'} records
- **Virtual Scrolling**: After ${func.priority === 'CRITICAL' ? '50' : '100'} records
- **Pagination Option**: ${func.priority === 'CRITICAL' ? '50' : '100'} per page
- **Search Debounce**: 300ms
- **Cache Duration**: ${func.priority === 'CRITICAL' ? '30 seconds' : '5 minutes'}

### Indexing Requirements
\`\`\`javascript
// MongoDB indexes needed
db.${func.collection}.createIndex({ patientId: 1, date: -1 })
db.${func.collection}.createIndex({ status: 1, practiceId: 1 })
${func.category === 'Diagnostic' ? `db.${func.collection}.createIndex({ "result.isAbnormal": 1 })` : ''}
${hasRealTimeUpdates ? `db.${func.collection}.createIndex({ lastModifiedAt: -1 })` : ''}
\`\`\`

### Caching Strategy
- Cache grid configuration: 24 hours
- Cache column preferences: Per user
- Cache frequently accessed data: ${func.priority === 'CRITICAL' ? '30 seconds' : '5 minutes'}
- Invalidate on: Create, Update, Delete

## Security & Compliance

### Access Control
- **View**: ${func.priority === 'CRITICAL' ? 'All clinical staff' : 'Based on role'}
- **Edit**: ${func.priority === 'CRITICAL' ? 'Authorized providers only' : 'Based on permissions'}
- **Delete**: ${func.priority === 'CRITICAL' ? 'Administrators only' : 'Supervisors and above'}
- **Export**: Audit trail required

### HIPAA Compliance
- PHI fields encrypted at rest
- Audit all access and modifications
- Implement break-glass access for emergencies
- Support data retention policies

### Data Validation
- Required fields validation
- Data type validation
- Range validation for numeric fields
- Cross-field validation rules

## Integration Points

### Connected Systems
- **Patient Records**: Link to patient profile
- **Provider System**: Link to provider schedule
${func.category === 'Diagnostic' ? '- **Lab System**: Real-time result updates' : ''}
${func.category === 'Imaging' ? '- **PACS**: Image viewing integration' : ''}
${func.category === 'Core Medical Records' ? '- **Billing System**: Charge capture' : ''}
- **Document Management**: Attachment storage
- **Notification System**: Alert on critical values

### API Endpoints
- GET /api/medical/${func.collection}
- POST /api/medical/${func.collection}
- PUT /api/medical/${func.collection}/:id
- DELETE /api/medical/${func.collection}/:id
- GET /api/medical/${func.collection}/export

## User Interface Requirements

### Grid Features
- Resizable columns
- Reorderable columns
- Sticky header on scroll
- Freeze first column option
- Column show/hide menu
- Density options (Compact/Normal/Comfortable)

### Visual Indicators
${func.priority === 'CRITICAL' ? '- 🔴 Red row for critical values' : ''}
${func.category === 'Diagnostic' ? '- 🔺 Up arrow for high values\n- 🔻 Down arrow for low values' : ''}
- 🆕 Badge for new records (< 24 hours)
- 📝 Icon for records with notes
- 🔒 Lock icon for read-only records
- ⚠️ Warning for pending actions

### Responsive Design
- **Desktop**: Full grid with all columns
- **Tablet**: Hide secondary columns, show in details
- **Mobile**: Card view with key information

## Test Scenarios

### Functional Tests
1. ✅ Load grid with no data
2. ✅ Load grid with 1 record
3. ✅ Load grid with 1000+ records
4. ✅ Sort by each column (asc/desc)
5. ✅ Filter by each filter type
6. ✅ Combine multiple filters
7. ✅ Clear all filters
8. ✅ Search functionality
9. ✅ Row selection (single/multiple)
10. ✅ Row actions work correctly

### Performance Tests
1. ⚡ Initial load < 2 seconds
2. ⚡ Sort operation < 500ms
3. ⚡ Filter operation < 500ms
4. ⚡ Scroll performance > 60fps
5. ⚡ Export 1000 records < 5 seconds

### Accessibility Tests
1. ♿ Keyboard navigation
2. ♿ Screen reader compatibility
3. ♿ Color contrast compliance
4. ♿ Focus indicators visible
5. ♿ ARIA labels present

### Security Tests
1. 🔒 Permission enforcement
2. 🔒 SQL injection prevention
3. 🔒 XSS prevention
4. 🔒 Audit trail generation
5. 🔒 PHI encryption verification

## API Response Structure

\`\`\`javascript
{
  success: true,
  data: [
    {
      _id: "ObjectId",
      patientId: "ObjectId",
      patientName: "John Doe", // Denormalized for performance
      ...columns, // All column data
      _metadata: {
        createdAt: "2025-01-26T10:00:00Z",
        createdBy: "user123",
        lastModifiedAt: "2025-01-26T11:00:00Z",
        lastModifiedBy: "user456",
        version: 2
      }
    }
  ],
  pagination: {
    total: 500,
    page: 1,
    pageSize: 100,
    totalPages: 5
  },
  metadata: {
    gridType: "${func.collection}",
    columns: [...], // Column definitions
    filters: {...}, // Applied filters
    sort: {...}, // Applied sorting
    userPreferences: {...} // User's saved preferences
  },
  warnings: [], // Any warnings
  performance: {
    queryTime: 145, // ms
    totalTime: 203 // ms
  }
}
\`\`\`

## Error Handling

### Client-Side Errors
- Network timeout: Show retry button
- Invalid data: Highlight field with error
- Permission denied: Show appropriate message
- Session expired: Redirect to login

### Server-Side Errors
- Database timeout: Return cached data if available
- Invalid query: Return error with details
- Rate limiting: Return 429 with retry-after
- Server error: Log and return generic message

## Implementation Checklist

### Backend Tasks
- [ ] Create MongoDB schema for ${func.collection}
- [ ] Add indexes for performance
- [ ] Implement GET endpoint with filtering
- [ ] Implement sorting logic
- [ ] Implement pagination
- [ ] Add data validation
- [ ] Add permission checks
- [ ] Implement audit logging
- [ ] Add caching layer
- [ ] Write API documentation

### Frontend Tasks
- [ ] Create grid component
- [ ] Implement column configuration
- [ ] Add sorting functionality
- [ ] Add filter components
- [ ] Implement row selection
- [ ] Add row actions menu
- [ ] Implement bulk actions
- [ ] Add export functionality
- [ ] Implement responsive design
- [ ] Add loading states
- [ ] Add error handling
- [ ] Implement user preferences

### Testing Tasks
- [ ] Write unit tests for API
- [ ] Write unit tests for grid component
- [ ] Write integration tests
- [ ] Performance testing
- [ ] Security testing
- [ ] Accessibility testing
- [ ] Cross-browser testing
- [ ] Mobile testing

### Documentation Tasks
- [ ] API documentation
- [ ] User guide
- [ ] Admin guide
- [ ] Troubleshooting guide

## Estimated Time

### Development Hours
- **Backend Development**: ${func.priority === 'CRITICAL' ? '5' : func.priority === 'HIGH' ? '4' : '3'} hours
- **Frontend Development**: ${func.priority === 'CRITICAL' ? '6' : func.priority === 'HIGH' ? '5' : '4'} hours
- **Testing**: ${func.priority === 'CRITICAL' ? '4' : func.priority === 'HIGH' ? '3' : '2'} hours
- **Documentation**: 2 hours
- **Total**: ${func.priority === 'CRITICAL' ? '17' : func.priority === 'HIGH' ? '14' : '11'} hours

### Dependencies
- Grid component library (AG-Grid or similar)
- Date handling (moment.js or date-fns)
- Export libraries (xlsx, jsPDF)
- Icons (Material Icons or FontAwesome)

## Related Functions
${func.id > 1 ? `- Previous: [${String(func.id - 1).padStart(3, '0')}-${getFunctions[func.id - 2]?.name || 'N/A'}]` : ''}
${func.id < 184 ? `- Next: [${String(func.id + 1).padStart(3, '0')}-${getFunctions[func.id]?.name || 'N/A'}]` : ''}
- Related: [List other related functions in same category]

## Notes & Considerations
- ${func.priority === 'CRITICAL' ? '⚠️ CRITICAL FUNCTION - Requires immediate real-time updates' : ''}
- ${func.priority === 'HIGH' ? '📊 High usage function - Optimize for performance' : ''}
- ${hasAuditTrail ? '📝 Full audit trail required for compliance' : ''}
- ${hasExportCompliance ? '📤 Export functionality must comply with data regulations' : ''}
- Consider implementing predictive search
- May need offline capability for mobile
- Review with clinical staff before deployment

## Sign-off
- [ ] Developer completed
- [ ] Code review passed
- [ ] QA testing passed
- [ ] Clinical review completed
- [ ] Deployed to staging
- [ ] Deployed to production

---
Generated: ${new Date().toISOString()}
`;
}

// Main function to generate all task files
async function generateAllTaskFiles() {
  const tasksDir = path.join(__dirname, 'tasks');

  // Ensure tasks directory exists
  if (!fs.existsSync(tasksDir)) {
    fs.mkdirSync(tasksDir, { recursive: true });
  }

  let generated = 0;
  let skipped = 0;
  let errors = 0;

  console.log('📋 Starting task file generation for 184 GET functions...\n');

  for (const func of getFunctions) {
    const fileName = `${String(func.id).padStart(3, '0')}-${func.name}.md`;
    const filePath = path.join(tasksDir, fileName);

    try {
      // Skip if file already exists
      if (fs.existsSync(filePath)) {
        console.log(`⏭️  Skipping ${fileName} (already exists)`);
        skipped++;
        continue;
      }

      // Generate and write task file
      const content = generateTaskContent(func);
      fs.writeFileSync(filePath, content);
      console.log(`✅ Generated ${fileName}`);
      generated++;

      // Add small delay to prevent file system overload
      if (generated % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`❌ Error generating ${fileName}:`, error.message);
      errors++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Task Generation Summary:');
  console.log('='.repeat(60));
  console.log(`✅ Generated: ${generated} files`);
  console.log(`⏭️  Skipped: ${skipped} files`);
  console.log(`❌ Errors: ${errors} files`);
  console.log(`📁 Total: ${generated + skipped} / 184 files`);
  console.log('='.repeat(60));

  if (generated > 0) {
    console.log('\n🎉 Success! Task files have been generated.');
    console.log('📍 Location: ./tasks/');
    console.log('📝 Next step: Start implementing each function according to its task file.');
  }

  if (errors > 0) {
    console.log('\n⚠️ Warning: Some files had errors. Please check the output above.');
  }

  return { generated, skipped, errors };
}

// Run the generator
if (require.main === module) {
  generateAllTaskFiles().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { generateAllTaskFiles, generateColumns, generateTaskContent };