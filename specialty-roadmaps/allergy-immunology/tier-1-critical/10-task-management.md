# Task & Workflow Management

## Purpose
Close the loop on clinical recommendations. Transform AI insights from "suggestions" to "completed actions". Track provider tasks from creation to resolution.

---

## Clinical Background

### The Problem
IntelliCare generates excellent recommendations:
- "Obtain venom testing"
- "Schedule psychology referral"
- "Verify EpiPen technique"
- "Check prior authorization status"

**But who does it? When? Was it done?**

### The Solution
**Task Management System** that:
1. Creates actionable tasks from AI recommendations
2. Assigns to appropriate team member
3. Tracks completion with deadlines
4. Alerts on overdue items
5. Documents outcomes

---

## Data Model

### Collection: `clinical_tasks`

#### Schema
```
{
  taskId: String (unique, auto-generated),
  patientId: ObjectId (required),
  patientName: String,  // Denormalized for display

  task: {
    type: String (enum: [
      'order-test',
      'schedule-appointment',
      'verify-safety',
      'medication-change',
      'patient-education',
      'prior-authorization',
      'follow-up-call',
      'documentation',
      'referral',
      'other'
    ]),
    title: String (required),  // "Obtain venom testing"
    description: String,       // Detailed instructions
    priority: String (enum: ['low', 'medium', 'high', 'urgent']),
    urgency: String (enum: ['routine', 'soon', 'today', 'immediate'])
  },

  assignment: {
    assignedTo: ObjectId (userId),
    assignedBy: ObjectId (userId),
    assignedDate: Date,
    role: String (enum: ['physician', 'nurse', 'ma', 'admin', 'pharmacy'])
  },

  schedule: {
    dueDate: Date,
    estimatedMinutes: Number,
    recurrence: String (enum: ['once', 'daily', 'weekly', 'monthly']),
    reminderDays: Number  // Days before due to remind
  },

  status: {
    current: String (enum: [
      'pending',
      'in-progress',
      'completed',
      'cancelled',
      'deferred',
      'blocked'
    ]),
    completedDate: Date,
    completedBy: ObjectId,
    outcome: String,
    notes: String
  },

  dependencies: [{
    taskId: String,
    type: String (enum: ['requires', 'blocks', 'relates-to'])
  }],

  source: {
    type: String (enum: [
      'ai-recommendation',
      'clinical-decision-support',
      'follow-up-intelligence',
      'manual-entry',
      'protocol',
      'quality-measure'
    ]),
    referenceId: String,  // ID of source document/recommendation
    aiConfidence: Number (0-100)
  },

  tracking: {
    attempts: Number,
    lastAttempt: Date,
    barriers: [String],
    escalated: Boolean,
    escalatedTo: ObjectId,
    escalationDate: Date
  },

  metadata: {
    category: String,  // 'asthma', 'allergy', 'safety', etc.
    relatedData: Mixed,  // Store context like medication name, test type
    billingCode: String,
    timeLogged: Number  // Actual minutes spent
  },

  createdAt: Date,
  updatedAt: Date
}
```

---

## Functions Needed

### Core Functions
```javascript
createTask(patientId, taskDetails, assignee, dueDate, priority)
// Returns: { success, taskId, task }

updateTaskStatus(taskId, status, outcome, notes)
// Returns: { success, updatedTask, notifications }

assignTask(taskId, newAssignee, reason)
// Returns: { success, notifications }

getTaskList(filters)
// Filters: assignedTo, status, priority, dueDate range, patientId
// Returns: Array of tasks with counts by status

completeTask(taskId, outcome, completedBy)
// Returns: { success, task, nextActions }

escalateTask(taskId, reason, escalateTo)
// Returns: { success, notifications }

createTasksFromAIRecommendations(patientId, recommendations)
// Auto-generate tasks from AI output
// Returns: { success, tasksCreated, taskIds }
```

### Analytics Functions
```javascript
getOverdueTasks(practiceId, userId)
// Returns: Tasks past due date

getTaskCompletionMetrics(practiceId, timeframe)
// Returns: Completion rate, average time, by type

identifyBottlenecks(practiceId)
// Returns: Task types with low completion rates

getUserWorkload(userId)
// Returns: Current tasks, estimated hours, overload warning

predictTaskCompletionTime(taskType, priority)
// Returns: Estimated completion time based on historical data
```

---

## Task Types & Templates

### Order Test
**Template:**
- Title: "Order [test name] for [patient]"
- Assigned to: MA or Nurse
- Estimated time: 10 minutes
- Required info: Test type, ICD-10 codes, lab facility

**Completion criteria:**
- Order placed in lab system
- Patient notified
- Follow-up scheduled for results

### Schedule Appointment
**Template:**
- Title: "Schedule [specialty] appointment for [patient]"
- Assigned to: Scheduling staff
- Estimated time: 15 minutes
- Required info: Specialty, urgency, patient availability

**Completion criteria:**
- Appointment scheduled
- Patient confirmed
- Reminder set

### Verify Safety
**Template:**
- Title: "Verify [safety item] for [patient]"
- Assigned to: Nurse or MA
- Estimated time: 5-10 minutes
- Required info: What to verify (EpiPen, bracelet, technique)

**Completion criteria:**
- Verification completed
- Documentation in chart
- Patient education if needed

### Medication Change
**Template:**
- Title: "Implement medication change for [patient]"
- Assigned to: Physician or Pharmacist
- Estimated time: 20 minutes
- Required info: Medication, dosage, reason

**Completion criteria:**
- Prescription sent
- Patient counseled
- Follow-up scheduled

### Prior Authorization
**Template:**
- Title: "Submit prior auth for [medication] - [patient]"
- Assigned to: Prior auth specialist
- Estimated time: 45 minutes
- Required info: Medication, insurance, clinical justification

**Completion criteria:**
- Prior auth submitted
- Tracking number obtained
- Follow-up date set

---

## User Interface

### Provider Dashboard
**Location:** Main dashboard, "My Tasks" widget

**Components:**
1. **Task Summary Cards**
   - Urgent (red)
   - Due Today (orange)
   - This Week (yellow)
   - Total Open (blue)

2. **Task List View**
   - Sortable by: due date, priority, patient, type
   - Filterable by: status, assignee, date range
   - Bulk actions: assign, defer, complete

3. **Task Detail Modal**
   - Patient context panel (photo, allergies, recent visits)
   - Task details and history
   - Quick actions: complete, defer, escalate, reassign
   - Time logging
   - Add notes

4. **Calendar Integration**
   - Tasks shown on calendar by due date
   - Drag-and-drop to reschedule
   - Color-coded by priority

### Patient Chart Integration
**Location:** Patient chart, "Tasks" tab

**Components:**
1. **Active Tasks for This Patient**
   - All open tasks
   - Completed tasks (last 30 days)
   - Task timeline

2. **Quick Task Creation**
   - Common task templates
   - Auto-populate patient info
   - Assign and set due date

---

## Business Logic

### Priority Calculation
```javascript
function calculatePriority(recommendation) {
  let score = 0;

  // Clinical urgency
  if (recommendation.urgency === 'immediate') score += 50;
  if (recommendation.urgency === 'high') score += 30;

  // Safety concerns
  if (recommendation.category === 'anaphylaxis') score += 40;
  if (recommendation.category === 'medication-safety') score += 30;

  // Patient risk
  if (patient.riskLevel === 'high') score += 20;

  // Quality measures
  if (recommendation.qualityMeasure) score += 10;

  return score >= 70 ? 'urgent' :
         score >= 40 ? 'high' :
         score >= 20 ? 'medium' : 'low';
}
```

### Due Date Calculation
```javascript
function calculateDueDate(taskType, priority) {
  const urgencyMap = {
    'urgent': 0,      // Today
    'high': 2,        // 2 days
    'medium': 7,      // 1 week
    'low': 30         // 1 month
  };

  const days = urgencyMap[priority] || 7;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
```

### Auto-Assignment Logic
```javascript
function autoAssign(taskType) {
  const assignmentRules = {
    'order-test': 'role:ma',
    'schedule-appointment': 'role:admin',
    'medication-change': 'role:physician',
    'prior-authorization': 'role:prior-auth-specialist',
    'patient-education': 'role:nurse'
  };

  return findAvailableUser(assignmentRules[taskType]);
}
```

---

## Integration Points

### AI Recommendations
**Trigger:** When AI generates recommendations
**Action:** Auto-create tasks for actionable items
**Example:**
```
AI Output: "Obtain venom testing to confirm bee allergy"
→ Task created: "Order venom panel for Helen Cox"
→ Assigned to: MA
→ Due: 2 days
→ Priority: High (anaphylaxis history)
```

### Clinical Decision Support
**Trigger:** CDS identifies safety issue
**Action:** Create urgent task
**Example:**
```
CDS Alert: "Drug interaction detected: Aspirin + AERD"
→ Task created: "Review aspirin use with Helen Cox"
→ Assigned to: Physician
→ Due: Today
→ Priority: Urgent
```

### Follow-Up Intelligence
**Trigger:** Follow-up recommendation
**Action:** Create scheduled task
**Example:**
```
Follow-up rec: "Recheck ACT score in 3 months"
→ Task created: "Administer ACT to Helen Cox"
→ Assigned to: Nurse
→ Due: 2025-04-15
→ Priority: Medium
```

---

## Notifications & Reminders

### Email Notifications
- Task assigned to you
- Task due in 2 days
- Task overdue
- Task escalated

### In-App Alerts
- Urgent tasks created
- Tasks due today
- Overdue task count

### Daily Digest
- Morning summary of day's tasks
- Overdue task list
- Tasks completed yesterday

---

## Success Criteria

### Adoption
- ✅ 90% of AI recommendations converted to tasks
- ✅ 100% of urgent tasks assigned within 1 hour
- ✅ 80% of users log in daily to check tasks

### Performance
- ✅ 95% of urgent tasks completed same day
- ✅ 85% of high-priority tasks completed within 2 days
- ✅ 70% of medium-priority tasks completed within 7 days

### Clinical Impact
- ✅ Zero missed follow-ups on safety items
- ✅ 90% of referrals tracked to completion
- ✅ Average time from recommendation to action: <48 hours

---

## Timeline
**Week 1:** Database schema + core functions
**Week 2:** Provider UI + task list
**Week 3:** AI integration + auto-creation
**Week 4:** Notifications + analytics

**Total Effort:** 60 hours
