/**
 * VaccinationHelpers - Extracted helper functions from agentServiceV4
 * Auto-generated on 2025-10-06T13:43:17.481Z
 */

class VaccinationHelpers {

    calculateTimeSinceVaccination(dateAdministered) {
      const now = new Date();
      const vaccinationDate = new Date(dateAdministered);
      const diffInMs = now - vaccinationDate;
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
      const diffInMonths = Math.floor(diffInDays / 30);
      const diffInYears = Math.floor(diffInDays / 365);
      
      return {
        days: diffInDays,
        months: diffInMonths,
        years: diffInYears,
        text: diffInYears > 0 ? `${diffInYears} years` : 
              diffInMonths > 0 ? `${diffInMonths} months` : 
              `${diffInDays} days`
      };
    }

    checkBoosterNeeded(vaccination, timeSince) {
      const vaccine = vaccination.vaccineName.toLowerCase();
      
      // Define booster requirements
      const boosterRequirements = {
        'tetanus': { years: 10, message: 'Tetanus booster recommended every 10 years' },
        'tdap': { years: 10, message: 'Tdap booster recommended every 10 years' },
        'influenza': { years: 1, message: 'Annual flu vaccination recommended' },
        'flu': { years: 1, message: 'Annual flu vaccination recommended' },
        'covid-19': { months: 6, message: 'COVID-19 booster may be recommended' },
        'pneumonia': { years: 5, message: 'Pneumonia vaccine may need update' }
      };
      
      for (const [vaccineType, requirement] of Object.entries(boosterRequirements)) {
        if (vaccine.includes(vaccineType)) {
          const isOverdue = requirement.years ? 
            timeSince.years >= requirement.years : 
            timeSince.months >= requirement.months;
          
          return {
            needed: isOverdue,
            type: vaccineType,
            message: requirement.message,
            timeSinceLastDose: timeSince.text
          };
        }
      }
      
      return { needed: false };
    }

    determineVaccinationStatus(vaccination, timeSince) {
      const boosterInfo = this.checkBoosterNeeded(vaccination, timeSince);
      
      if (boosterInfo.needed) {
        return 'needs_booster';
      }
      
      // Check if recently administered
      if (timeSince.days <= 30) {
        return 'recent';
      }
      
      // Check if current/valid
      if (timeSince.years < 1) {
        return 'current';
      }
      
      return 'historical';
    }

    groupVaccinations(vaccinations) {
      const grouped = {
        byType: {},
        byStatus: {
          current: [],
          needs_booster: [],
          recent: [],
          historical: []
        },
        bySeries: {},
        timeline: []
      };
  
      vaccinations.forEach(vaccination => {
        // Group by vaccine type
        const vaccineType = vaccination.vaccineName.split(' ')[0].toLowerCase();
        if (!grouped.byType[vaccineType]) {
          grouped.byType[vaccineType] = [];
        }
        grouped.byType[vaccineType].push(vaccination);
  
        // Group by status
        const status = vaccination.status || 'historical';
        grouped.byStatus[status].push(vaccination);
  
        // Group by series
        if (vaccination.seriesInfo?.seriesName) {
          const seriesName = vaccination.seriesInfo.seriesName;
          if (!grouped.bySeries[seriesName]) {
            grouped.bySeries[seriesName] = [];
          }
          grouped.bySeries[seriesName].push(vaccination);
        }
  
        // Timeline entry
        grouped.timeline.push({
          date: vaccination.dateAdministered,
          vaccine: vaccination.vaccineName,
          status: vaccination.status
        });
      });
  
      // Sort timeline by date
      grouped.timeline.sort((a, b) => new Date(b.date) - new Date(a.date));
  
      return grouped;
    }

    analyzeVaccinationSchedule(vaccinations, patient) {
      const analysis = {
        completeness: 0,
        upToDate: false,
        missingVaccines: [],
        overdueVaccines: [],
        seriesStatus: {}
      };
  
      // Age-appropriate vaccine list
      const requiredVaccines = this.getRequiredVaccinesForAge(patient.age);
      
      // Check each required vaccine
      requiredVaccines.forEach(requiredVaccine => {
        const hasVaccine = vaccinations.some(v => 
          v.vaccineName.toLowerCase().includes(requiredVaccine.toLowerCase())
        );
        
        if (!hasVaccine) {
          analysis.missingVaccines.push(requiredVaccine);
        }
      });
  
      // Calculate completeness
      analysis.completeness = Math.round(
        ((requiredVaccines.length - analysis.missingVaccines.length) / requiredVaccines.length) * 100
      );
  
      // Check for overdue boosters
      analysis.overdueVaccines = vaccinations
        .filter(v => v.boosterInfo?.needed)
        .map(v => v.vaccineName);
  
      analysis.upToDate = analysis.missingVaccines.length === 0 && analysis.overdueVaccines.length === 0;
  
      return analysis;
    }

    getRequiredVaccinesForAge(age) {
      if (age < 2) {
        return ['DTaP', 'IPV', 'Hib', 'PCV13', 'Rotavirus', 'Hepatitis B'];
      } else if (age < 18) {
        return ['DTaP', 'IPV', 'MMR', 'Varicella', 'Hepatitis B', 'HPV'];
      } else if (age < 65) {
        return ['Tdap', 'Influenza', 'COVID-19'];
      } else {
        return ['Tdap', 'Influenza', 'COVID-19', 'Pneumonia', 'Shingles'];
      }
    }

    generateVaccinationRecommendations(patient, existingVaccinations, practiceContext) {
      const isHebrew = practiceContext.language === 'he';
      const recommendations = [];
      
      const requiredVaccines = this.getRequiredVaccinesForAge(patient.age);
      
      requiredVaccines.forEach(vaccine => {
        const hasVaccine = existingVaccinations.some(v => 
          v.vaccineName.toLowerCase().includes(vaccine.toLowerCase())
        );
        
        if (!hasVaccine) {
          recommendations.push({
            vaccine: vaccine,
            priority: this.getVaccinePriority(vaccine, patient.age),
            reason: isHebrew 
              ? `מומלץ לגיל ${patient.age}`
              : `Recommended for age ${patient.age}`,
            type: 'missing'
          });
        }
      });
  
      // Check for needed boosters
      existingVaccinations.forEach(vaccination => {
        if (vaccination.boosterInfo?.needed) {
          recommendations.push({
            vaccine: vaccination.vaccineName,
            priority: 'high',
            reason: isHebrew 
              ? `נדרש חיסון חוזר`
              : `Booster needed`,
            type: 'booster',
            lastDose: vaccination.formattedDate
          });
        }
      });
  
      // Sort by priority
      const priorityOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
      recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  
      return recommendations;
    }

    getVaccinePriority(vaccine, age) {
      const critical = ['COVID-19', 'Influenza'];
      const high = ['Tetanus', 'Tdap', 'MMR', 'DTaP'];
      
      if (critical.some(v => vaccine.includes(v))) return 'critical';
      if (high.some(v => vaccine.includes(v))) return 'high';
      return 'medium';
    }

    generateVaccinationAlerts(vaccinations, recommendations, practiceContext) {
      const alerts = [];
      const isHebrew = practiceContext.language === 'he';
  
      // Critical missing vaccines
      const criticalMissing = recommendations.filter(r => r.priority === 'critical');
      if (criticalMissing.length > 0) {
        alerts.push({
          type: 'critical',
          message: isHebrew 
            ? `חסרים ${criticalMissing.length} חיסונים קריטיים`
            : `${criticalMissing.length} critical vaccines missing`,
          vaccines: criticalMissing.map(r => r.vaccine)
        });
      }
  
      // Overdue boosters
      const overdueBoosters = vaccinations.filter(v => v.boosterInfo?.needed);
      if (overdueBoosters.length > 0) {
        alerts.push({
          type: 'warning',
          message: isHebrew 
            ? `${overdueBoosters.length} חיסונים זקוקים לחידוש`
            : `${overdueBoosters.length} vaccines need boosters`,
          vaccines: overdueBoosters.map(v => v.vaccineName)
        });
      }
  
      // Annual vaccines due
      const currentYear = new Date().getFullYear();
      const hasCurrentFlu = vaccinations.some(v => 
        v.vaccineName.toLowerCase().includes('flu') && 
        new Date(v.dateAdministered).getFullYear() === currentYear
      );
      
      if (!hasCurrentFlu) {
        alerts.push({
          type: 'info',
          message: isHebrew 
            ? 'חיסון שפעת שנתי לא נמצא'
            : 'Annual flu vaccination not found'
        });
      }
  
      return alerts;
    }

    generateVaccinationSummary(vaccinations, patient, practiceContext) {
      const isHebrew = practiceContext.language === 'he';
      
      const summary = {
        total: vaccinations.length,
        current: vaccinations.filter(v => v.status === 'current').length,
        needsBoosters: vaccinations.filter(v => v.boosterInfo?.needed).length,
        recent: vaccinations.filter(v => v.status === 'recent').length
      };
  
      // Most recent vaccination
      if (vaccinations.length > 0) {
        const mostRecent = vaccinations[0]; // Already sorted by date
        summary.mostRecent = {
          vaccine: mostRecent.vaccineName,
          date: mostRecent.formattedDate
        };
      }
  
      // Compliance status
      const requiredCount = this.getRequiredVaccinesForAge(patient.age).length;
      const hasCount = vaccinations.filter(v => v.status === 'current').length;
      summary.compliance = Math.round((hasCount / requiredCount) * 100);
  
      // Text summary
      summary.text = isHebrew 
        ? `${summary.total} חיסונים (${summary.current} עדכניים, ${summary.needsBoosters} זקוקים לחידוש)`
        : `${summary.total} vaccinations (${summary.current} current, ${summary.needsBoosters} need boosters)`;
  
      return summary;
    }

    generateVaccinationsMessage(vaccinations, recommendations, practiceContext) {
      const isHebrew = practiceContext.language === 'he';
  
      if (vaccinations.length === 0) {
        return isHebrew ? 'לא נמצאו חיסונים קודמים' : 'No previous vaccinations found';
      }
  
      const current = vaccinations.filter(v => v.status === 'current').length;
      const needsBoosters = vaccinations.filter(v => v.boosterInfo?.needed).length;
      const criticalMissing = recommendations.filter(r => r.priority === 'critical').length;
  
      let message = isHebrew 
        ? `נמצאו ${vaccinations.length} חיסונים`
        : `Found ${vaccinations.length} vaccinations`;
  
      if (criticalMissing > 0) {
        message += isHebrew 
          ? ` - חסרים ${criticalMissing} חיסונים קריטיים`
          : ` - ${criticalMissing} critical vaccines missing`;
      } else if (needsBoosters > 0) {
        message += isHebrew 
          ? ` - ${needsBoosters} זקוקים לחידוש`
          : ` - ${needsBoosters} need boosters`;
      } else if (current === vaccinations.length) {
        message += isHebrew 
          ? ' - כל החיסונים עדכניים'
          : ' - all vaccinations current';
      }
  
      return message;
    }

    validateVaccineForAge(vaccineName, age) {
      const vaccine = vaccineName.toLowerCase();
      
      // Pediatric vaccines (0-18 years)
      const pediatricVaccines = ['dtap', 'mmr', 'varicella', 'hib', 'pcv13', 'rotavirus'];
      if (pediatricVaccines.some(v => vaccine.includes(v)) && age > 18) {
        return {
          appropriate: false,
          reason: 'Typically given to children'
        };
      }
      
      // Adult vaccines
      if (vaccine.includes('shingles') && age < 50) {
        return {
          appropriate: false,
          reason: 'Recommended for adults 50 and older'
        };
      }
      
      if (vaccine.includes('pneumonia') && age < 65 && !this.hasHighRiskConditions(age)) {
        return {
          appropriate: false,
          reason: 'Typically recommended for adults 65+ or high-risk conditions'
        };
      }
      
      return { appropriate: true };
    }

    hasHighRiskConditions(age) {
      // This would normally check patient's medical history
      // Simplified for this implementation
      return age >= 50; // Simplified risk assessment
    }

    getVaccineSeriesInfo(vaccineName, existingVaccinations) {
      const vaccine = vaccineName.toLowerCase();
      
      // Define vaccine series
      const vaccineSeries = {
        'hepatitis b': { totalDoses: 3, intervals: [0, 28, 168] }, // 0, 1 month, 6 months
        'hpv': { totalDoses: 3, intervals: [0, 60, 180] }, // 0, 2 months, 6 months
        'covid-19': { totalDoses: 2, intervals: [0, 21] }, // Primary series
        'dtap': { totalDoses: 5, intervals: [0, 60, 120, 360, 1440] }, // Complex pediatric schedule
        'mmr': { totalDoses: 2, intervals: [0, 28] }
      };
      
      // Find matching series
      const seriesName = Object.keys(vaccineSeries).find(name => vaccine.includes(name));
      if (!seriesName) {
        return { 
          nextDoseNumber: 1, 
          isComplete: true, // Single dose vaccine
          totalDoses: 1 
        };
      }
      
      const series = vaccineSeries[seriesName];
      const completedDoses = existingVaccinations.filter(v => 
        v.vaccineName.toLowerCase().includes(seriesName)
      ).length;
      
      return {
        nextDoseNumber: completedDoses + 1,
        isComplete: completedDoses >= series.totalDoses,
        totalDoses: series.totalDoses,
        seriesName: seriesName
      };
    }

    calculateNextDoseDate(vaccineName, currentDate, seriesInfo) {
      if (seriesInfo.isComplete || seriesInfo.nextDoseNumber >= seriesInfo.totalDoses) {
        return null; // No more doses needed
      }
      
      const vaccine = vaccineName.toLowerCase();
      const current = new Date(currentDate);
      
      // Standard intervals (in days)
      const intervals = {
        'hepatitis b': seriesInfo.nextDoseNumber === 2 ? 28 : 168,
        'hpv': seriesInfo.nextDoseNumber === 2 ? 60 : 180,
        'covid-19': 21,
        'dtap': [60, 120, 360, 1440][seriesInfo.nextDoseNumber - 1] || 365,
        'mmr': 28
      };
      
      // Find matching vaccine
      const seriesName = Object.keys(intervals).find(name => vaccine.includes(name));
      const daysToAdd = seriesName ? intervals[seriesName] : 365; // Default 1 year
      
      const nextDate = new Date(current);
      nextDate.setDate(nextDate.getDate() + daysToAdd);
      
      return nextDate.toISOString();
    }

    generateVaccinationCard(vaccination, patient, practiceContext) {
      const isHebrew = practiceContext.language === 'he';
      
      return {
        title: isHebrew ? 'תעודת חיסון' : 'Vaccination Certificate',
        patientName: `${patient.firstName} ${patient.lastName}`,
        vaccine: vaccination.vaccineName,
        date: new Date(vaccination.dateAdministered).toLocaleDateString(
          isHebrew ? 'he-IL' : 'en-US'
        ),
        dose: vaccination.doseNumber,
        site: vaccination.site,
        lotNumber: vaccination.lotNumber,
        administeredBy: vaccination.administeredBy,
        practice: practiceContext.practiceName || 'IntelliCare Practice',
        verificationCode: this.generateVerificationCode(vaccination)
      };
    }

    generateVaccinationReminders(vaccination, practiceContext) {
      const isHebrew = practiceContext.language === 'he';
      const reminders = [];
      
      if (vaccination.nextDoseDate) {
        const nextDate = new Date(vaccination.nextDoseDate);
        const reminderDate = new Date(nextDate);
        reminderDate.setDate(reminderDate.getDate() - 7); // 1 week before
        
        reminders.push({
          type: 'next_dose',
          date: reminderDate.toISOString(),
          message: isHebrew 
            ? `תזכורת: המנה הבאה של ${vaccination.vaccineName} מתוכננת ל-${nextDate.toLocaleDateString('he-IL')}`
            : `Reminder: Next dose of ${vaccination.vaccineName} scheduled for ${nextDate.toLocaleDateString('en-US')}`
        });
      }
      
      // Annual reminder for certain vaccines
      const annualVaccines = ['flu', 'influenza'];
      if (annualVaccines.some(v => vaccination.vaccineName.toLowerCase().includes(v))) {
        const nextYear = new Date(vaccination.dateAdministered);
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        
        reminders.push({
          type: 'annual',
          date: nextYear.toISOString(),
          message: isHebrew 
            ? `תזכורת: חיסון שנתי ${vaccination.vaccineName}`
            : `Reminder: Annual ${vaccination.vaccineName} vaccination`
        });
      }
      
      return reminders;
    }

    generateVaccinationMessage(vaccination, seriesInfo, practiceContext) {
      const isHebrew = practiceContext.language === 'he';
      
      let message = isHebrew 
        ? `החיסון ${vaccination.vaccineName} (מנה ${vaccination.doseNumber}) נרשם בהצלחה`
        : `Vaccination ${vaccination.vaccineName} (dose ${vaccination.doseNumber}) recorded successfully`;
      
      if (seriesInfo.isComplete) {
        message += isHebrew 
          ? '. ✅ סדרת החיסונים הושלמה'
          : '. ✅ Vaccination series completed';
      } else if (vaccination.nextDoseDate) {
        const nextDate = new Date(vaccination.nextDoseDate).toLocaleDateString(
          isHebrew ? 'he-IL' : 'en-US'
        );
        message += isHebrew 
          ? `. המנה הבאה מתוכננת ל-${nextDate}`
          : `. Next dose scheduled for ${nextDate}`;
      }
      
      return message;
    }
}

module.exports = VaccinationHelpers;
