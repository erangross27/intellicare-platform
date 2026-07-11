/**
 * Follow-Up Intelligence Formatter
 *
 * Formats follow_up_intelligence collection documents for display to doctors.
 * This collection contains AI-generated follow-up recommendations, deadlines,
 * prioritization, and care coordination needs.
 */

function formatDate(dateValue) {
  if (!dateValue) return 'Unknown date';
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (err) {
    return 'Unknown date';
  }
}

module.exports = function formatFollowUpIntelligence(doc) {
  const lines = [];

  // ========== DEADLINES ==========
  const deadlines = doc.deadlines || doc.upcomingDeadlines || [];
  if (deadlines.length > 0) {
    lines.push(`\n📅 Upcoming Deadlines (${deadlines.length}):`);
    deadlines.forEach((deadline, idx) => {
      lines.push(`\n${idx + 1}. ${deadline.item || deadline.testName || deadline.name || 'Follow-up item'}`);
      if (deadline.criticality) lines.push(`   Priority: ${deadline.criticality}`);
      if (deadline.priority) lines.push(`   Priority: ${deadline.priority}`);
      if (deadline.dueDate) lines.push(`   Due: ${formatDate(deadline.dueDate)}`);
      if (deadline.consequences) lines.push(`   Consequences: ${deadline.consequences}`);
      if (deadline.consequencesIfMissed) lines.push(`   Consequences: ${deadline.consequencesIfMissed}`);
      if (deadline.autoSchedule !== undefined) lines.push(`   Auto-schedule: ${deadline.autoSchedule}`);
      if (deadline.autoScheduleRecommendation) lines.push(`   Auto-schedule: ${deadline.autoScheduleRecommendation}`);
    });
  }

  // ========== PRIORITIZATION ==========
  if (doc.prioritization && doc.prioritization.length > 0) {
    lines.push(`\n\n📋 Prioritization (${doc.prioritization.length} tasks):`);
    doc.prioritization.forEach((task, idx) => {
      lines.push(`\n${task.priority || idx + 1}. ${task.task}`);
      if (task.urgency) lines.push(`   Urgency: ${task.urgency}`);
      if (task.importance) lines.push(`   Importance: ${task.importance}`);
      if (task.dependencies && task.dependencies.length > 0) {
        lines.push(`   Dependencies: ${task.dependencies.join(', ')}`);
      }
    });
  }

  // ========== COORDINATION NEEDS ==========
  if (doc.coordinationNeeds && doc.coordinationNeeds.length > 0) {
    lines.push(`\n\n👥 Coordination Needs (${doc.coordinationNeeds.length} specialists):`);
    doc.coordinationNeeds.forEach((coord, idx) => {
      lines.push(`\n${idx + 1}. ${coord.specialist}`);
      if (coord.urgency) lines.push(`   Urgency: ${coord.urgency}`);
      if (coord.reason) lines.push(`   Reason: ${coord.reason}`);

      if (coord.informationNeeded && coord.informationNeeded.length > 0) {
        lines.push(`   Information Needed:`);
        coord.informationNeeded.forEach(info => {
          lines.push(`     - ${info}`);
        });
      }

      if (coord.expectedOutcome) lines.push(`   Expected Outcome: ${coord.expectedOutcome}`);
    });
  }

  // ========== OTHER FIELDS ==========
  if (doc.otherMedicalConditions && doc.otherMedicalConditions.length > 0) {
    lines.push(`\n\n🏥 Other Medical Conditions:`);
    doc.otherMedicalConditions.forEach(condition => {
      lines.push(`  • ${condition}`);
    });
  }

  if (doc.summary) {
    lines.push(`\n\n📋 Summary: ${doc.summary}`);
  }

  return lines.join('\n');
};
