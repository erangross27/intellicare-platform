module.exports = {
  title: '📚 Patient Education',
  columns: ['Date', 'Topic', 'Resources', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };

    // Flatten topics array into individual rows
    const rows = [];
    categoryData.forEach(entry => {
      const date = entry.date ? new Date(entry.date).toLocaleDateString() : '-';
      const globalResources = entry.resourcesProvided || entry.resources;
      const provider = getValue(entry.providedBy || entry.educator || entry.provider);

      if (entry.topics && Array.isArray(entry.topics)) {
        // Create a separate row for each topic
        entry.topics.forEach(topic => {
          const topicText = typeof topic === 'object' ? getValue(topic.topic) : getValue(topic);

          // Use topic-specific materials if available, otherwise fall back to global resources
          let resources;
          if (typeof topic === 'object' && topic.materials) {
            // Topic has its own materials - use them
            resources = getValue(topic.materials);
          } else if (globalResources) {
            // No topic-specific materials - use global resources (old format)
            resources = Array.isArray(globalResources)
              ? globalResources.join(',')
              : getValue(globalResources);
          } else {
            resources = '-';
          }

          rows.push({
            'Date': date,
            'Topic': topicText,
            'Resources': resources,
            'Provider': provider
          });
        });
      } else if (entry.topic || entry.subject) {
        // Single topic
        const resources = Array.isArray(globalResources)
          ? globalResources.join(',')
          : getValue(globalResources);

        rows.push({
          'Date': date,
          'Topic': getValue(entry.topic || entry.subject),
          'Resources': resources,
          'Provider': provider
        });
      }
    });

    return rows;
  }
};
