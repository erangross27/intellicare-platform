module.exports = {
  title: '🔍 Care Gaps & Screening (AI)',
  columns: ['Date', 'Screening Type', 'Category', 'Status', 'Due Date', 'Action Required', 'Priority'],
  columnWidths: {
    'Due Date': 120  // Make Due Date column wider to prevent wrapping
  },
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };

    const formatStatus = (status) => {
      if (status === 'Missing') return '⚠️ Missing';
      if (status === 'Overdue') return '🚨 Overdue';
      if (status === 'Due Soon') return '⏰ Due Soon';
      if (status === 'Completed') return '✅ Completed';
      return status;
    };

    const capitalizeFirst = (text) => {
      if (!text) return text;
      const trimmed = String(text).trim();
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    };

    const rows = [];

    categoryData.forEach(entry => {
      const date = entry.date ? new Date(entry.date).toLocaleDateString() : '-';

      if (entry.screenings && Array.isArray(entry.screenings)) {
        entry.screenings.forEach(screening => {
          // Format due date to prevent line breaks
          let dueDate = getValue(screening.dueDate);
          if (dueDate !== '-') {
            try {
              // If it's a valid date string, format it consistently
              const parsedDate = new Date(dueDate);
              if (!isNaN(parsedDate)) {
                dueDate = parsedDate.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit'
                });
              }
            } catch (e) {
              // Keep original if parsing fails
            }
          }

          rows.push({
            'Date': date,
            'Screening Type': getValue(screening.screeningType),
            'Category': getValue(screening.category),
            'Status': formatStatus(getValue(screening.status)),
            'Due Date': dueDate,
            'Action Required': capitalizeFirst(getValue(screening.actionRequired)),
            'Priority': getValue(screening.priority)
          });
        });
      }
    });

    return rows;
  }
};
