module.exports = {
  title: '🫁 Asthma Assessment',
  columns: ['Date', 'Severity', 'Control', 'Peak Flow', 'Triggers', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => {
      // Extract FEV1 from nested peakFlowPersonalBest structure
      let fev1 = '-';
      if (entry.peakFlowPersonalBest && entry.peakFlowPersonalBest.current) {
        fev1 = entry.peakFlowPersonalBest.current;
      } else if (entry.fev1) {
        fev1 = entry.fev1;
      } else if (entry.spirometry) {
        fev1 = entry.spirometry;
      }

      // Build assessment from severity and control
      let assessment = '-';
      if (entry.severity || entry.control) {
        const parts = [];
        if (entry.severity) parts.push(entry.severity);
        if (entry.control) parts.push(entry.control);
        assessment = parts.join(' - ');
      } else if (entry.assessment) {
        assessment = entry.assessment;
      } else if (entry.impression) {
        assessment = entry.impression;
      }

      // Extract chief complaint or reason
      let chiefComplaint = '-';
      if (entry.chiefComplaint) {
        chiefComplaint = typeof entry.chiefComplaint === 'object' && entry.chiefComplaint.complaint
          ? entry.chiefComplaint.complaint
          : entry.chiefComplaint;
      } else if (entry.reason) {
        chiefComplaint = entry.reason;
      } else if (entry.triggers && Array.isArray(entry.triggers)) {
        chiefComplaint = `Triggers: ${entry.triggers.join(', ')}`;
      }

      return {
        Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
        Severity: getValue(entry.severity),
        Control: getValue(entry.control),
        'Peak Flow': getValue(fev1),
        Triggers: entry.triggers && Array.isArray(entry.triggers) ? entry.triggers.join(', ') : '-',
        Provider: getValue(entry.provider || entry.pulmonologist)
      };
    });
  }
};
