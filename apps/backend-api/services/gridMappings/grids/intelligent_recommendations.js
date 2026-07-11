module.exports = {
  title: 'Intelligent Recommendations (AI)',
  columns: ['date', 'priority', 'timeframe', 'recommendation', 'successMetrics', 'backupOptions', 'rationale', 'outcome'],
  headers: ['Date', 'Priority', 'Timeframe', 'Recommendation', 'Success Metrics', 'Backup Options', 'Rationale', 'Expected Outcome'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };

    const formatSuccessMetrics = (metrics) => {
      if (!metrics || typeof metrics !== 'object') return '-';

      const parts = [];
      if (metrics.primaryMetric) {
        parts.push(`🎯 Primary: ${metrics.primaryMetric}`);
      }
      if (metrics.secondaryMetrics && Array.isArray(metrics.secondaryMetrics)) {
        parts.push(`Secondary:\n${metrics.secondaryMetrics.map(m => `• ${m}`).join('\n')}`);
      }
      if (metrics.assessmentMethod) {
        parts.push(`Method: ${metrics.assessmentMethod}`);
      }
      if (metrics.targetDate) {
        parts.push(`Target: ${metrics.targetDate}`);
      }

      // Handle array format (long-term)
      if (Array.isArray(metrics)) {
        return metrics.map(m => `• ${m}`).join('\n');
      }

      // Handle object format with metrics array (short-term)
      if (metrics.metrics && Array.isArray(metrics.metrics)) {
        return metrics.metrics.map(m => `• ${m}`).join('\n');
      }

      return parts.length > 0 ? parts.join('\n') : '-';
    };

    const formatBackupOptions = (backups) => {
      if (!backups || !Array.isArray(backups) || backups.length === 0) return '-';

      return backups.map(backup => {
        const parts = [`🔄 ${getValue(backup.option)}`];
        if (backup.indication) {
          parts.push(`When: ${backup.indication}`);
        }
        if (backup.mechanism) {
          parts.push(`How: ${backup.mechanism}`);
        }
        return parts.join('\n');
      }).join('\n\n');
    };

    const rows = [];

    categoryData.forEach(entry => {
      const date = entry.date ? new Date(entry.date).toLocaleDateString() : '-';

      // Psycho-behavioral support (show first - critical for comprehensive care)
      if (entry.psychoBehavioralSupport && Array.isArray(entry.psychoBehavioralSupport)) {
        entry.psychoBehavioralSupport.forEach(pbs => {
          rows.push({
            date,
            'priority': getValue(pbs.priority, 'Medium'),
            'timeframe': '🧠 Psycho-Behavioral',
            'recommendation': getValue(pbs.recommendation),
            'successMetrics': getValue(pbs.expectedOutcome),
            'backupOptions': '-',
            'rationale': `${getValue(pbs.concern)}\n\n${getValue(pbs.rationale)}`,
            'outcome': getValue(pbs.expectedOutcome)
          });
        });
      }

      // Immediate recommendations
      if (entry.immediate && Array.isArray(entry.immediate)) {
        entry.immediate.forEach(rec => {
          rows.push({
            date,
            'priority': getValue(rec.priority),
            'timeframe': 'Immediate',
            'recommendation': getValue(rec.action),
            'successMetrics': formatSuccessMetrics(rec.successMetrics),
            'backupOptions': formatBackupOptions(rec.backupOptions),
            'rationale': getValue(rec.rationale),
            'outcome': getValue(rec.evidence)
          });
        });
      }

      // Short-term recommendations
      if (entry.shortTerm && Array.isArray(entry.shortTerm)) {
        entry.shortTerm.forEach(rec => {
          rows.push({
            date,
            'priority': 'Short-term',
            'timeframe': getValue(rec.timeframe),
            'recommendation': getValue(rec.action),
            'successMetrics': formatSuccessMetrics(rec.successMetrics),
            'backupOptions': '-',
            'rationale': getValue(rec.rationale),
            'outcome': getValue(rec.expectedOutcome)
          });
        });
      }

      // Long-term recommendations
      if (entry.longTerm && Array.isArray(entry.longTerm)) {
        entry.longTerm.forEach(rec => {
          rows.push({
            date,
            'priority': 'Long-term',
            'timeframe': getValue(rec.timeline),
            'recommendation': getValue(rec.goal),
            'successMetrics': formatSuccessMetrics(rec.successMetrics),
            'backupOptions': getValue(rec.backupPlan, '-'),
            'rationale': getValue(rec.interventions ? rec.interventions.join(', ') : '-'),
            'outcome': getValue(rec.successMetrics ? (Array.isArray(rec.successMetrics) ? rec.successMetrics.join(', ') : rec.successMetrics) : '-')
          });
        });
      }

      // Preventive recommendations
      if (entry.preventive && Array.isArray(entry.preventive)) {
        entry.preventive.forEach(rec => {
          rows.push({
            date,
            'priority': 'Preventive',
            'timeframe': getValue(rec.dueDate),
            'recommendation': getValue(rec.screening),
            'successMetrics': '-',
            'backupOptions': '-',
            'rationale': getValue(rec.indication),
            'outcome': getValue(rec.guidelines)
          });
        });
      }
    });

    return rows;
  }
};
