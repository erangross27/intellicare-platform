module.exports = {
  title: 'Trending Analysis (AI)',
  columns: ['date', 'category', 'parameter', 'trend', 'latestValue', 'interpretation', 'action', 'priority', 'timeline'],
  headers: ['Date', 'Category', 'Parameter', 'Trend', 'Latest Value', 'Interpretation', 'Action Needed', 'Priority', 'Reassess'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };

    const rows = [];

    categoryData.forEach(entry => {
      const date = entry.date ? new Date(entry.date).toLocaleDateString() : '-';

      // Vital Signs Trends
      if (entry.vitalSignsTrends && Array.isArray(entry.vitalSignsTrends)) {
        entry.vitalSignsTrends.forEach(trend => {
          // Use latestValue field if present, otherwise extract from values array
          const latestValue = trend.latestValue || (trend.values && trend.values.length > 0 ?
            getValue(trend.values[trend.values.length - 1].value) : '-');

          // Build action display with monitoring threshold
          let actionDisplay = getValue(trend.actionNeeded || trend.clinicalSignificance);
          if (trend.monitoringThreshold) {
            actionDisplay += `\n⚠️ Threshold: ${trend.monitoringThreshold}`;
          }

          rows.push({
            date,
            'category': 'Vital Signs',
            'parameter': getValue(trend.parameter),
            'trend': getValue(trend.trend),
            'latestValue': latestValue,
            'interpretation': getValue(trend.interpretation),
            'action': actionDisplay,
            'priority': getValue(trend.priority),
            'timeline': getValue(trend.reassessmentTimeline)
          });
        });
      }

      // Lab Trends
      if (entry.labTrends && Array.isArray(entry.labTrends)) {
        entry.labTrends.forEach(trend => {
          // Use latestValue field if present, otherwise extract from values array
          const latestValue = trend.latestValue || (trend.values && trend.values.length > 0 ?
            getValue(trend.values[trend.values.length - 1].value) + ' (' + getValue(trend.values[trend.values.length - 1].flag) + ')' : '-');

          // Build action display with target value
          let actionDisplay = getValue(trend.actionNeeded);
          if (trend.targetValue) {
            actionDisplay += `\n🎯 Target: ${trend.targetValue}`;
          }

          rows.push({
            date,
            'category': 'Laboratory',
            'parameter': getValue(trend.test),
            'trend': getValue(trend.trend),
            'latestValue': latestValue,
            'interpretation': getValue(trend.interpretation),
            'action': actionDisplay,
            'priority': getValue(trend.priority),
            'timeline': getValue(trend.reassessmentTimeline)
          });
        });
      }

      // Disease Progression
      if (entry.diseaseProgression) {
        rows.push({
          date,
          'category': 'Disease Progression',
          'parameter': 'Overall Trajectory',
          'trend': getValue(entry.diseaseProgression.trajectory),
          'latestValue': getValue(entry.diseaseProgression.timeline),
          'interpretation': getValue(entry.diseaseProgression.prognosis),
          'action': getValue(entry.diseaseProgression.keyEvents ?
            entry.diseaseProgression.keyEvents.map(e => e.event).join('; ') : '-'),
          'priority': '-',
          'timeline': '-'
        });
      }
    });

    return rows;
  }
};
