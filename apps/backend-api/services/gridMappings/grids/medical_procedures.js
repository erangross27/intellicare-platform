module.exports = {
  title: '⚕️ Medical Procedures',
  columns: ['Date', 'Procedure', 'Provider', 'Indication', 'Outcome'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };

    return categoryData.map(entry => {
      // Determine outcome based on available data
      let outcome = '-';

      // Check notes first (for scheduled/deferred procedures)
      if (entry.notes && entry.notes.trim()) {
        const notesText = getValue(entry.notes);
        if (notesText.toLowerCase().includes('deferred') ||
            notesText.toLowerCase().includes('scheduled') ||
            notesText.toLowerCase().includes('planned')) {
          outcome = `📅 ${notesText}`;
        } else {
          outcome = notesText;
        }
      }
      // Check findings
      else if (entry.findings && entry.findings.trim()) {
        outcome = getValue(entry.findings);
      }
      // Check outcome field
      else if (entry.outcome && entry.outcome.trim()) {
        outcome = getValue(entry.outcome);
      }
      // Check result field
      else if (entry.result && entry.result.trim()) {
        outcome = getValue(entry.result);
      }
      // Check status
      else if (entry.status) {
        const status = getValue(entry.status);
        if (status === 'completed') {
          outcome = '✅ Completed';
        } else if (status === 'scheduled' || status === 'planned') {
          outcome = '📅 Scheduled';
        } else {
          outcome = status;
        }
      }
      // If procedure exists but no outcome info, assume completed
      else if (entry.name || entry.procedure) {
        outcome = '✅ Completed';
      }

      return {
        Date: entry.date ? new Date(entry.date).toLocaleDateString() : (entry.procedureDate ? new Date(entry.procedureDate).toLocaleDateString() : '-'),
        Procedure: getValue(entry.procedure || entry.procedureName || entry.name),
        Provider: getValue(entry.provider || entry.performer),
        Indication: getValue(entry.indication || entry.reason),
        Outcome: outcome
      };
    });
  }
};
