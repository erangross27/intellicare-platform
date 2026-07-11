import React from 'react';
import LabDocumentViewer from './categories/LabDocumentViewer';
import PrescriptionViewer from './categories/PrescriptionViewer';
import ImagingDocumentViewer from './categories/ImagingDocumentViewer';
import DischargeViewer from './categories/DischargeViewer';
import ConsultationViewer from './categories/ConsultationViewer';
import VaccinationDocumentViewer from './categories/VaccinationDocumentViewer';
import ReferralViewer from './categories/ReferralViewer';
import MedicalCertificateViewer from './categories/MedicalCertificateViewer';
import ProcedureViewer from './categories/ProcedureViewer';
import GenericDocumentViewer from './GenericDocumentViewer';

const DocumentCategoryRouter = ({ document, language }) => {
  // Get the document category from AI classification or file type
  const category = document?.aiClassification?.documentType || 
                   document?.fileType || 
                   document?.category ||
                   'general';
  
  // Route to the appropriate viewer based on category
  switch (category) {
    case 'lab_results':
      return <LabDocumentViewer document={document} language={language} />;
    
    case 'prescriptions':
      return <PrescriptionViewer document={document} language={language} />;
    
    case 'imaging_reports':
    case 'medical_imaging/mri':
    case 'medical_imaging/ct':
    case 'medical_imaging/xray':
    case 'medical_imaging/ultrasound':
      return <ImagingDocumentViewer document={document} language={language} />;
    
    case 'discharge_summary':
      return <DischargeViewer document={document} language={language} />;
    
    case 'consultation_notes':
      return <ConsultationViewer document={document} language={language} />;
    
    case 'vaccination_records':
      return <VaccinationDocumentViewer document={document} language={language} />;
    
    case 'referrals':
      return <ReferralViewer document={document} language={language} />;
    
    case 'medical_certificate':
      return <MedicalCertificateViewer document={document} language={language} />;
    
    case 'medical_procedures':
      return <ProcedureViewer document={document} language={language} />;
    
    default:
      return <GenericDocumentViewer document={document} language={language} />;
  }
};

export default DocumentCategoryRouter;