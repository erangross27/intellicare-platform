module.exports = {
  title: '🏃 Lifestyle Counseling',
  columns: ['Date', 'Topic', 'Recommendations', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };

    // Fields to skip (metadata, not lifestyle topics)
    const skipFields = ['_id', 'patientId', 'documentId', 'date', 'provider', 'source', '_securityMetadata'];

    // Topic name mapping for better display
    const topicNames = {
      diet: 'Diet',
      exercise: 'Exercise',
      stress: 'Stress Management',
      alcohol: 'Alcohol',
      weight: 'Weight Management',
      smoking: 'Smoking',
      sleep: 'Sleep',
      occupation: 'Occupation',
      activity: 'Physical Activity',
      nutrition: 'Nutrition',
      substanceUse: 'Substance Use',
      sexualActivity: 'Sexual Activity',
      hobbies: 'Hobbies',
      socialSupport: 'Social Support'
    };

    const rows = [];
    categoryData.forEach(entry => {
      const date = entry.date ? new Date(entry.date).toLocaleDateString() : '-';
      const provider = getValue(entry.provider);

      // Dynamically iterate through all fields
      Object.keys(entry).forEach(key => {
        // Skip metadata fields
        if (skipFields.includes(key)) return;

        const value = getValue(entry[key]);
        if (value !== '-') {
          rows.push({
            Date: date,
            Topic: topicNames[key] || key.charAt(0).toUpperCase() + key.slice(1),
            Recommendations: value,
            Provider: provider
          });
        }
      });
    });

    return rows;
  }
};
