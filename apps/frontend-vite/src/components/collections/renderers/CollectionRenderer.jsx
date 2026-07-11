import React from 'react';
import MedicationsRenderer from './MedicationsRenderer';
import DiagnosesRenderer from './DiagnosesRenderer';
import LabResultsRenderer from './LabResultsRenderer';
import VitalSignsRenderer from './VitalSignsRenderer';
import AllergiesRenderer from './AllergiesRenderer';
import ImagingReportsRenderer from './ImagingReportsRenderer';
import ProceduresRenderer from './ProceduresRenderer';
import ClinicalDecisionSupportRenderer from './ClinicalDecisionSupportRenderer';
import IntelligentRecommendationsRenderer from './IntelligentRecommendationsRenderer';
import TrendingAnalysisRenderer from './TrendingAnalysisRenderer';
import PatientCarePlanRenderer from './PatientCarePlanRenderer';
import MedicationOptimizationRenderer from './MedicationOptimizationRenderer';
import FollowUpIntelligenceRenderer from './FollowUpIntelligenceRenderer';
import PatientEducationRenderer from './PatientEducationRenderer';
import OutcomesPredictionRenderer from './OutcomesPredictionRenderer';
import GuidelineComplianceRenderer from './GuidelineComplianceRenderer';
import './CollectionRenderer.css';

/**
 * CollectionRenderer - Routes collection data to specialized renderers
 *
 * PURPOSE:
 * Routes individual collection data (medications, labs, vitals) to specialized UI renderers.
 * This is for GRANULAR COLLECTION viewing (Path 2 of two-path architecture).
 *
 * TWO-PATH ARCHITECTURE:
 * - Path 1: unified_medical_documents → Complete docs (AIDocumentRenderer)
 * - Path 2: Granular collections → THIS FILE (CollectionRenderer)
 *
 * Props:
 * @param {string} collection - Collection name (e.g., 'medications', 'lab_results')
 * @param {Array} data - Array of records from that collection
 * @param {string} patientId - Patient ID
 */
const CollectionRenderer = ({ collection, data, patientId }) => {

  /**
   * Collection Router - Maps collection names to renderer components
   */
  const renderCollection = () => {
    console.log('[CollectionRenderer] Routing:', { collection, dataLength: data?.length });

    // Normalize collection name
    const normalizedCollection = collection?.toLowerCase().trim();

    switch (normalizedCollection) {
      // Universal Collections
      case 'medications':
        return <MedicationsRenderer data={data} patientId={patientId} />;

      case 'diagnoses':
        return <DiagnosesRenderer data={data} patientId={patientId} />;

      case 'lab_results':
      case 'labresults':
        return <LabResultsRenderer data={data} patientId={patientId} />;

      case 'vital_signs':
      case 'vitalsigns':
        return <VitalSignsRenderer data={data} patientId={patientId} />;

      case 'allergies':
        return <AllergiesRenderer data={data} patientId={patientId} />;

      case 'imaging_reports':
      case 'imagingreports':
        return <ImagingReportsRenderer data={data} patientId={patientId} />;

      case 'procedures':
      case 'medicalprocedures':
        return <ProceduresRenderer data={data} patientId={patientId} />;

      // AI Collections
      case 'clinical_decision_support':
        return <ClinicalDecisionSupportRenderer data={data} patientId={patientId} />;

      case 'intelligent_recommendations':
        return <IntelligentRecommendationsRenderer data={data} patientId={patientId} />;

      case 'trending_analysis':
        return <TrendingAnalysisRenderer data={data} patientId={patientId} />;

      case 'patient_specific_care_plan':
        return <PatientCarePlanRenderer data={data} patientId={patientId} />;

      case 'medication_optimization':
        return <MedicationOptimizationRenderer data={data} patientId={patientId} />;

      case 'follow_up_intelligence':
        return <FollowUpIntelligenceRenderer data={data} patientId={patientId} />;

      case 'patient_education_context':
        return <PatientEducationRenderer data={data} patientId={patientId} />;

      case 'outcomes_prediction':
        return <OutcomesPredictionRenderer data={data} patientId={patientId} />;

      // Compliance
      case 'guideline_compliance':
        return <GuidelineComplianceRenderer data={data} patientId={patientId} />;

      // Fallback
      default:
        console.warn('[CollectionRenderer] No renderer for collection:', collection);
        return renderGenericCollection();
    }
  };

  /**
   * Generic renderer for unknown collections
   */
  const renderGenericCollection = () => {
    return (
      <div className="collection-renderer generic">
        <div className="collection-header">
          <h2>{formatCollectionName(collection)}</h2>
          <span className="record-count">{data?.length || 0} records</span>
        </div>

        <div className="collection-content">
          {!data || data.length === 0 ? (
            <p className="no-data">No records found</p>
          ) : (
            <pre className="json-view">
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
        </div>
      </div>
    );
  };

  /**
   * Format collection name for display
   */
  const formatCollectionName = (name) => {
    return name
      ?.replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown Collection';
  };

  // Main render
  return (
    <div className="collection-renderer-wrapper">
      {renderCollection()}
    </div>
  );
};

export default CollectionRenderer;
