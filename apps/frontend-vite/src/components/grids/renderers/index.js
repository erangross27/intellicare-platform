// Medical Grid Cell Renderers
// Central export for all custom cell renderers used in medical data grids

import StatusBadgeRenderer from './StatusBadgeRenderer';
import DateRenderer from './DateRenderer';
import LinkRenderer from './LinkRenderer';
import SeverityRenderer from './SeverityRenderer';
import LabResultRenderer from './LabResultRenderer';
import MedicationRenderer from './MedicationRenderer';
import BloodPressureRenderer from './BloodPressureRenderer';
import TriageLevelRenderer from './TriageLevelRenderer';

export {
  StatusBadgeRenderer,
  DateRenderer,
  LinkRenderer,
  SeverityRenderer,
  LabResultRenderer,
  MedicationRenderer,
  BloodPressureRenderer,
  TriageLevelRenderer
};

// Renderer mapping for dynamic loading
export const rendererMap = {
  StatusBadgeRenderer,
  DateRenderer,
  LinkRenderer,
  SeverityRenderer,
  LabResultRenderer,
  MedicationRenderer,
  BloodPressureRenderer,
  TriageLevelRenderer,

  // Aliases for common use cases
  TimeRenderer: DateRenderer,
  DateTimeRenderer: DateRenderer,
  PatientLinkRenderer: LinkRenderer,
  AllergenRenderer: SeverityRenderer,
  VitalRenderer: LabResultRenderer,
  EmergencyStatusRenderer: StatusBadgeRenderer
};

// Get renderer by name
export const getRenderer = (rendererName) => {
  if (!rendererName) return null;
  return rendererMap[rendererName] || null;
};