module.exports = {
  title: 'Follow-up Intelligence (AI)',
  columns: ['date', 'type', 'task', 'dueDate', 'priority', 'successMetrics', 'consequences', 'autoSchedule'],
  headers: ['Date', 'Type', 'Task/Item', 'Due Date', 'Priority/Urgency', 'Success Metrics', 'Consequences if Missed', 'Auto-Schedule'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };

    const formatDueDate = (dueDateStr) => {
      if (!dueDateStr || dueDateStr === '-') return '-';

      // Extract date from text like "Within 1 week (by December 5, 2024)"
      const dateMatch = dueDateStr.match(/by\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
      if (!dateMatch) return dueDateStr; // Return as-is if no date found

      const dateStr = dateMatch[1];
      const dueDate = new Date(dateStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);

      if (dueDate < today) {
        // Calculate how overdue
        const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
        const monthsOverdue = Math.floor(daysOverdue / 30);

        if (monthsOverdue > 0) {
          return `🚨 OVERDUE ${monthsOverdue} month${monthsOverdue > 1 ? 's' : ''} (was ${dueDateStr})`;
        } else {
          return `🚨 OVERDUE ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} (was ${dueDateStr})`;
        }
      }

      return dueDateStr; // Not overdue, return original
    };

    const formatSuccessMetrics = (metrics) => {
      if (!metrics || typeof metrics !== 'object') return '-';

      const parts = [];

      if (metrics.primaryMetric || metrics.expectedOutcome) {
        const metric = metrics.primaryMetric || metrics.expectedOutcome;
        parts.push(`📊 ${metric}`);
      }

      if (metrics.baselineValue && metrics.targetValue) {
        parts.push(`Baseline: ${metrics.baselineValue}`);
        parts.push(`Target: ${metrics.targetValue}${metrics.targetDate ? ` by ${metrics.targetDate}` : ''}`);
      }

      if (metrics.secondaryMetrics && Array.isArray(metrics.secondaryMetrics) && metrics.secondaryMetrics.length > 0) {
        const secondary = metrics.secondaryMetrics.map(m =>
          `${m.metric}: ${m.baseline} → ${m.target}`
        ).join('\n');
        parts.push(`\nSecondary:\n${secondary}`);
      }

      if (metrics.outcomeAssessment) {
        parts.push(`\nAssessment: ${metrics.outcomeAssessment}`);
      }

      if (metrics.measurableIndicator) {
        parts.push(`Indicator: ${metrics.measurableIndicator}`);
      }

      if (metrics.completionCriteria) {
        parts.push(`Completion: ${metrics.completionCriteria}`);
      }

      return parts.length > 0 ? parts.join('\n') : '-';
    };

    const rows = [];

    categoryData.forEach(entry => {
      const date = entry.date ? new Date(entry.date).toLocaleDateString() : '-';

      // Overall Treatment Goals (show first)
      if (entry.overallTreatmentGoals) {
        const goals = entry.overallTreatmentGoals;

        if (goals.quantitativeTargets && Array.isArray(goals.quantitativeTargets)) {
          goals.quantitativeTargets.forEach(target => {
            const metricsDisplay = [
              `📊 ${getValue(target.parameter)}`,
              target.currentValue ? `Baseline: ${target.currentValue}` : '',
              `Target: ${getValue(target.targetValue)}`,
              `Timeframe: ${getValue(target.timeframe)}`,
              target.assessmentMethod ? `Method: ${target.assessmentMethod}` : ''
            ].filter(x => x).join('\n');

            rows.push({
              date,
              'type': 'Treatment Goal',
              'task': getValue(goals.primaryGoal, 'Treatment Goal'),
              'dueDate': getValue(target.timeframe),
              'priority': 'Overall Goal',
              'successMetrics': metricsDisplay,
              'consequences': 'Primary outcome measure for treatment success',
              'autoSchedule': target.assessmentMethod ? 'Assessment method defined' : '-'
            });
          });
        }

        // Adaptation criteria (self-correcting logic)
        if (goals.adaptationCriteria && Array.isArray(goals.adaptationCriteria)) {
          goals.adaptationCriteria.forEach(adapt => {
            rows.push({
              date,
              'type': '🔄 Adaptation Rule',
              'task': getValue(adapt.trigger),
              'dueDate': '-',
              'priority': 'Self-Correcting',
              'successMetrics': `If target not met:\n${getValue(adapt.response)}`,
              'consequences': 'Plan adapts automatically if targets not achieved',
              'autoSchedule': 'Yes - dynamic'
            });
          });
        }
      }

      // Deadlines
      if (entry.deadlines && Array.isArray(entry.deadlines)) {
        entry.deadlines.forEach(deadline => {
          rows.push({
            date,
            'type': 'Deadline',
            'task': getValue(deadline.item),
            'dueDate': formatDueDate(getValue(deadline.dueDate)),
            'priority': getValue(deadline.criticality),
            'successMetrics': formatSuccessMetrics(deadline.successMetrics),
            'consequences': getValue(deadline.consequences),
            'autoSchedule': getValue(deadline.autoSchedule ? 'Yes' : 'No')
          });
        });
      }

      // Prioritization
      if (entry.prioritization && Array.isArray(entry.prioritization)) {
        entry.prioritization.forEach(item => {
          rows.push({
            date,
            'type': 'Priority Task',
            'task': getValue(item.task),
            'dueDate': getValue(item.dependencies ? 'Depends on: ' + item.dependencies.join(', ') : '-'),
            'priority': '#' + getValue(item.priority) + ' - ' + getValue(item.urgency),
            'successMetrics': formatSuccessMetrics(item.successMetrics),
            'consequences': getValue(item.importance),
            'autoSchedule': '-'
          });
        });
      }

      // Coordination Needs
      if (entry.coordinationNeeds && Array.isArray(entry.coordinationNeeds)) {
        entry.coordinationNeeds.forEach(coord => {
          rows.push({
            date,
            'type': 'Coordination',
            'task': 'Referral to ' + getValue(coord.specialist),
            'dueDate': '-',
            'priority': getValue(coord.urgency),
            'successMetrics': getValue(coord.expectedOutcome, '-'),
            'consequences': getValue(coord.reason),
            'autoSchedule': getValue(coord.informationNeeded ?
              'Info needed: ' + coord.informationNeeded.join(', ') : '-')
          });
        });
      }
    });

    return rows;
  }
};
