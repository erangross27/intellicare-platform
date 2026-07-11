/**
 * DocumentHelpers - Extracted helper functions from agentServiceV4
 * Auto-generated on 2025-10-06T13:43:17.481Z
 */

class DocumentHelpers {

    generateDocumentSummary(documents, practiceContext) {
      const isHebrew = practiceContext.language === 'he';
      const summary = {
        total: documents.length,
        byType: {},
        totalSize: 0,
        dateRange: { earliest: null, latest: null }
      };
  
      documents.forEach(doc => {
        // Count by type
        summary.byType[doc.type] = (summary.byType[doc.type] || 0) + 1;
        
        // Sum file sizes
        if (doc.size) summary.totalSize += doc.size;
        
        // Track date range
        const docDate = new Date(doc.date || doc.uploadedAt);
        if (!summary.dateRange.earliest || docDate < summary.dateRange.earliest) {
          summary.dateRange.earliest = docDate;
        }
        if (!summary.dateRange.latest || docDate > summary.dateRange.latest) {
          summary.dateRange.latest = docDate;
        }
      });
  
      summary.formattedSize = this.formatFileSize(summary.totalSize);
      return summary;
    }

    generateDocumentMessage(documents, practiceContext) {
      const isHebrew = practiceContext.language === 'he';
      
      if (documents.length === 0) {
        return isHebrew ? 'לא נמצאו מסמכים' : 'No documents found';
      }
      
      return isHebrew 
        ? `נמצאו ${documents.length} מסמכים`
        : `Found ${documents.length} documents`;
    }

    classifyDocumentType(extractedText, providedType) {
      if (providedType && providedType !== 'unknown') return providedType;
      
      const text = extractedText?.toLowerCase() || '';
      
      if (text.includes('lab') || text.includes('laboratory') || text.includes('test result')) {
        return 'lab_result';
      }
      if (text.includes('prescription') || text.includes('medication') || text.includes('rx')) {
        return 'prescription';
      }
      if (text.includes('imaging') || text.includes('x-ray') || text.includes('mri') || text.includes('ct')) {
        return 'imaging';
      }
      if (text.includes('referral') || text.includes('refer')) {
        return 'referral';
      }
      
      return 'other';
    }

    assessMedicalRelevance(extractedData) {
      if (!extractedData) return 'low';
      
      const relevanceFactors = [
        extractedData.medications?.length || 0,
        extractedData.diagnoses?.length || 0,
        extractedData.procedures?.length || 0,
        extractedData.labResults?.length || 0
      ];
      
      const totalFactors = relevanceFactors.reduce((sum, factor) => sum + factor, 0);
      
      if (totalFactors >= 5) return 'high';
      if (totalFactors >= 2) return 'medium';
      return 'low';
    }

    assessTextQuality(extractedText) {
      if (!extractedText) return 'poor';
      
      const length = extractedText.length;
      const words = extractedText.split(/\s+/).length;
      const avgWordLength = length / words;
      
      if (avgWordLength > 4 && words > 50) return 'excellent';
      if (avgWordLength > 3 && words > 20) return 'good';
      if (words > 10) return 'fair';
      return 'poor';
    }

    assessDataCompleteness(extractedData) {
      if (!extractedData) return 0;
      
      const fields = ['patientInfo', 'medicalData', 'medications', 'diagnoses'];
      const completedFields = fields.filter(field => 
        extractedData[field] && 
        (Array.isArray(extractedData[field]) ? extractedData[field].length > 0 : Object.keys(extractedData[field]).length > 0)
      );
      
      return completedFields.length / fields.length;
    }

    hasStructuredData(extractedData) {
      return extractedData && (
        (extractedData.medications && extractedData.medications.length > 0) ||
        (extractedData.diagnoses && extractedData.diagnoses.length > 0) ||
        (extractedData.labResults && extractedData.labResults.length > 0)
      );
    }

    generateAnalysisRecommendations(analysisData, practiceContext) {
      const isHebrew = practiceContext.language === 'he';
      const recommendations = [];
      
      if (analysisData.confidence < 0.8) {
        recommendations.push(isHebrew 
          ? 'מומלץ לבדוק ידנית את הנתונים שחולצו'
          : 'Manual review of extracted data recommended');
      }
      
      if (analysisData.extractedData?.medications?.length > 0) {
        recommendations.push(isHebrew 
          ? 'עדכן רשימת תרופות במערכת'
          : 'Update medication list in system');
      }
      
      return recommendations;
    }

    generateAnalysisSummary(analysisData, practiceContext) {
      const isHebrew = practiceContext.language === 'he';
      const confidence = Math.round((analysisData.confidence || 0.85) * 100);
      
      return isHebrew 
        ? `המסמך נותח בהצלחה עם רמת ביטחון של ${confidence}%`
        : `Document analyzed successfully with ${confidence}% confidence`;
    }

    generateDocumentSummary(analysis, document, practiceContext) {
      const isHebrew = practiceContext.language === 'he';
      
      if (!analysis || (!analysis.extractedText && !analysis.medications && !analysis.diagnoses)) {
        return isHebrew 
          ? `מסמך "${document.originalName}" נותח אך לא נמצא תוכן רפואי מובנה`
          : `Document "${document.originalName}" analyzed but no structured medical content found`;
      }
      
      const parts = [];
      
      // Document type and category
      if (document.organizedFolder) {
        parts.push(isHebrew 
          ? `סוג: ${document.organizedFolder}`
          : `Type: ${document.organizedFolder}`);
      }
      
      // Medications
      const medications = analysis.extractedData?.medications || analysis.medications || [];
      if (medications.length > 0) {
        parts.push(isHebrew 
          ? `תרופות: ${medications.slice(0, 3).map(m => m.name || m).join(', ')}`
          : `Medications: ${medications.slice(0, 3).map(m => m.name || m).join(', ')}`);
      }
      
      // Diagnoses
      const diagnoses = analysis.extractedData?.diagnoses || analysis.diagnoses || [];
      if (diagnoses.length > 0) {
        parts.push(isHebrew 
          ? `אבחנות: ${diagnoses.slice(0, 2).map(d => d.name || d).join(', ')}`
          : `Diagnoses: ${diagnoses.slice(0, 2).map(d => d.name || d).join(', ')}`);
      }
      
      // Lab results
      const labResults = analysis.extractedData?.labResults || analysis.labResults || [];
      if (labResults.length > 0) {
        parts.push(isHebrew 
          ? `בדיקות: ${labResults.length} תוצאות`
          : `Lab results: ${labResults.length} tests`);
      }
      
      return parts.length > 0 
        ? parts.join(isHebrew ? ' | ' : ' | ')
        : (isHebrew ? 'מסמך רפואי נותח' : 'Medical document analyzed');
    }

    hasVisualization(functionName) {
      const visualFunctions = [
        'searchPatients', 'getPatient', 'listPatients',
        'getLabResults', 'compareLabResults', 'getLabTrends',
        'getMedications', 'checkDrugInteractions',
        'getAppointments', 'getDocuments', 'viewDocument'
      ];
      return visualFunctions.includes(functionName);
    }

    getDisplayType(functionName) {
      const displayTypes = {
        searchPatients: 'table',
        getPatient: 'card',
        listPatients: 'grid',
        getLabResults: 'table',
        compareLabResults: 'chart',
        getLabTrends: 'chart',
        getMedications: 'cards',
        checkDrugInteractions: 'alert',
        getAppointments: 'calendar',
        getDocuments: 'gallery',
        viewDocument: 'viewer'
      };
      return displayTypes[functionName] || 'text';
    }
}

module.exports = DocumentHelpers;
