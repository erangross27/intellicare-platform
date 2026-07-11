/**
 * MedicationHelpers - Extracted helper functions from agentServiceV4
 * Auto-generated on 2025-10-06T13:43:17.481Z
 */

class MedicationHelpers {

    formatMedicationDisplay(med, practiceContext) {
      const isHebrew = practiceContext.language === 'he';
      
      let display = `${med.medicationName}`;
      
      if (med.dosage) {
        display += ` ${med.dosage}${med.dosageUnit || 'mg'}`;
      }
      
      if (med.frequency) {
        display += ` - ${med.frequencyDetails?.hebrew || med.frequency}`;
      }
      
      if (med.route && med.route !== 'oral') {
        const routeText = {
          'topical': isHebrew ? 'למריחה' : 'topical',
          'injection': isHebrew ? 'זריקה' : 'injection',
          'inhaled': isHebrew ? 'שאיפה' : 'inhaled'
        };
        display += ` (${routeText[med.route] || med.route})`;
      }
      
      if (med.isExpiring) {
        display += isHebrew ? ' ⚠️ עומד להסתיים' : ' ⚠️ Expiring soon';
      }
      
      if (med.needsRefill) {
        display += isHebrew ? ' 🔄 נדרש חידוש' : ' 🔄 Needs refill';
      }
      
      return display;
    }

    generateMedicationSummary(grouped, practiceContext) {
      const isHebrew = practiceContext.language === 'he';
      
      const summary = {
        total: grouped.all.length,
        active: grouped.active.length,
        discontinued: grouped.discontinued.length,
        completed: grouped.completed.length
      };
      
      // Count by route
      const byRoute = {};
      grouped.active.forEach(med => {
        const route = med.route || 'oral';
        byRoute[route] = (byRoute[route] || 0) + 1;
      });
      summary.byRoute = byRoute;
      
      // Average medications per day
      const dailyMeds = grouped.active.reduce((total, med) => {
        if (med.frequencyDetails?.times) {
          return total + med.frequencyDetails.times;
        }
        return total + 1;
      }, 0);
      summary.dailyPills = dailyMeds;
      
      // Text summary
      summary.text = isHebrew 
        ? `${summary.active} תרופות פעילות, ${dailyMeds} מנות ביום`
        : `${summary.active} active medications, ${dailyMeds} daily doses`;
      
      return summary;
    }

    generateMedicationMessage(grouped, practiceContext) {
      const isHebrew = practiceContext.language === 'he';
      
      if (grouped.all.length === 0) {
        return isHebrew ? 'לא נמצאו תרופות' : 'No medications found';
      }
      
      const parts = [];
      
      if (grouped.active.length > 0) {
        parts.push(isHebrew 
          ? `${grouped.active.length} תרופות פעילות`
          : `${grouped.active.length} active medications`);
      }
      
      if (grouped.discontinued.length > 0) {
        parts.push(isHebrew 
          ? `${grouped.discontinued.length} הופסקו`
          : `${grouped.discontinued.length} discontinued`);
      }
      
      if (grouped.completed.length > 0) {
        parts.push(isHebrew 
          ? `${grouped.completed.length} הסתיימו`
          : `${grouped.completed.length} completed`);
      }
      
      return parts.join(isHebrew ? ', ' : ', ');
    }
}

module.exports = MedicationHelpers;
