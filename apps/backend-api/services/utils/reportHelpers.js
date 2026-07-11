/**
 * ReportHelpers - Extracted helper functions from agentServiceV4
 * Auto-generated on 2025-10-06T13:43:17.481Z
 */

class ReportHelpers {

    generateVerificationCode(vaccination) {
      // Simple verification code based on vaccination data
      const data = `${vaccination.vaccineName}${vaccination.dateAdministered}${vaccination.patientId}`;
      return data.slice(-8).toUpperCase();
    }

    calculateCorrelation(data1, data2) {
      // Ensure both datasets have the same length
      if (!data1 || !data2 || data1.length !== data2.length || data1.length === 0) {
        return 0;
      }
      
      // Extract numeric values
      const values1 = data1.map(d => d.value || d.amount || d.count || 0);
      const values2 = data2.map(d => d.value || d.amount || d.count || 0);
      
      // Calculate means
      const mean1 = values1.reduce((a, b) => a + b, 0) / values1.length;
      const mean2 = values2.reduce((a, b) => a + b, 0) / values2.length;
      
      // Calculate correlation coefficient
      let numerator = 0;
      let denom1 = 0;
      let denom2 = 0;
      
      for (let i = 0; i < values1.length; i++) {
        const diff1 = values1[i] - mean1;
        const diff2 = values2[i] - mean2;
        
        numerator += diff1 * diff2;
        denom1 += diff1 * diff1;
        denom2 += diff2 * diff2;
      }
      
      if (denom1 === 0 || denom2 === 0) return 0;
      
      return numerator / Math.sqrt(denom1 * denom2);
    }

    interpretCorrelation(correlation) {
      const absCorr = Math.abs(correlation);
      
      if (absCorr >= 0.9) {
        return correlation > 0 ? 'Very strong positive correlation' : 'Very strong negative correlation';
      } else if (absCorr >= 0.7) {
        return correlation > 0 ? 'Strong positive correlation' : 'Strong negative correlation';
      } else if (absCorr >= 0.5) {
        return correlation > 0 ? 'Moderate positive correlation' : 'Moderate negative correlation';
      } else if (absCorr >= 0.3) {
        return correlation > 0 ? 'Weak positive correlation' : 'Weak negative correlation';
      } else {
        return 'No significant correlation';
      }
    }

    generateExecutiveReport(analytics, language) {
      const isHebrew = language === 'he';
      
      return {
        title: isHebrew ? 'דוח תקשורת מנהלים' : 'Executive Communication Report',
        keyMetrics: {
          totalCommunications: analytics.summary.totalCommunications,
          deliveryRate: analytics.summary.deliveryRate + '%',
          engagementRate: analytics.engagementMetrics.overallEngagement + '%',
          topChannel: this.getTopPerformingChannel(analytics.channelAnalysis)
        },
        insights: analytics.recommendations.slice(0, 3),
        trends: analytics.trends,
        nextSteps: this.generateNextSteps(analytics.recommendations, isHebrew)
      };
    }

    generateDetailedReport(analytics, language) {
      return {
        title: language === 'he' ? 'דוח תקשורת מפורט' : 'Detailed Communication Report',
        analytics: analytics,
        methodology: language === 'he' ? 'מתודולוגיית הניתוח' : 'Analysis Methodology',
        rawData: analytics.summary
      };
    }

    getTopPerformingChannel(channelAnalysis) {
      if (!channelAnalysis.effectiveness) return 'N/A';
      
      let topChannel = 'email';
      let topScore = 0;
      
      Object.keys(channelAnalysis.effectiveness).forEach(channel => {
        const score = parseFloat(channelAnalysis.effectiveness[channel].engagementRate);
        if (score > topScore) {
          topScore = score;
          topChannel = channel;
        }
      });
      
      return topChannel;
    }

    generateNextSteps(recommendations, isHebrew) {
      return recommendations.slice(0, 3).map(rec => ({
        action: rec.title[isHebrew ? 'he' : 'en'],
        priority: rec.priority,
        impact: rec.impact
      }));
    }
}

module.exports = ReportHelpers;
