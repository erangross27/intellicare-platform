/**
 * DICOM Converter Service
 * Parses DICOM (.dcm) binary files, extracts pixel data and metadata,
 * and converts to JPEG for Claude Vision analysis
 *
 * Pure JS implementation — no native dependencies
 */

const dicomParser = require('dicom-parser');
const jpeg = require('jpeg-js');

class DicomConverterService {
  constructor() {
    this.serviceId = 'dicom-converter-service';
  }

  /**
   * Full pipeline: parse DICOM buffer → extract pixel data + metadata → convert to JPEG
   * @param {Buffer} dicomBuffer - Raw DICOM file contents
   * @returns {{ imageBuffer: Buffer, mimeType: string, metadata: Object }}
   */
  async processForAnalysis(dicomBuffer) {
    const dataset = this.parseDicomFile(dicomBuffer);
    const metadata = this.extractMetadata(dataset);
    const pixelData = this.extractPixelData(dataset);

    if (!pixelData) {
      throw new Error('DICOM file does not contain pixel data');
    }

    const width = dataset.uint16('x00280011'); // Columns
    const height = dataset.uint16('x00280010'); // Rows
    if (!width || !height) {
      throw new Error('DICOM file missing image dimensions (Rows/Columns)');
    }

    // Get window/level for optimal contrast
    const windowCenter = dataset.floatString('x00281050') || null;
    const windowWidth = dataset.floatString('x00281051') || null;
    const bitsAllocated = dataset.uint16('x00280100') || 16;
    const bitsStored = dataset.uint16('x00280101') || bitsAllocated;
    const pixelRepresentation = dataset.uint16('x00280103') || 0; // 0 = unsigned, 1 = signed
    const photometricInterpretation = dataset.string('x00280004') || 'MONOCHROME2';

    const imageBuffer = this.convertToJpeg(
      pixelData, width, height,
      windowCenter, windowWidth,
      bitsAllocated, bitsStored,
      pixelRepresentation, photometricInterpretation
    );

    return {
      imageBuffer,
      mimeType: 'image/jpeg',
      metadata
    };
  }

  /**
   * Parse a DICOM binary buffer
   * @param {Buffer} buffer - Raw DICOM file
   * @returns {Object} dicomParser DataSet
   */
  parseDicomFile(buffer) {
    try {
      const byteArray = new Uint8Array(buffer);
      return dicomParser.parseDicom(byteArray);
    } catch (error) {
      throw new Error(`Failed to parse DICOM file: ${error.message}`);
    }
  }

  /**
   * Extract DICOM metadata tags
   * @param {Object} dataset - dicomParser DataSet
   * @returns {Object} Structured metadata
   */
  extractMetadata(dataset) {
    const getString = (tag) => {
      try { return dataset.string(tag) || null; } catch { return null; }
    };
    const getDate = (tag) => {
      const val = getString(tag);
      if (!val) return null;
      // DICOM dates are YYYYMMDD
      if (val.length === 8) {
        return `${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}`;
      }
      return val;
    };

    return {
      // Study identification
      studyInstanceUID: getString('x0020000d'),
      seriesInstanceUID: getString('x0020000e'),
      sopInstanceUID: getString('x00080018'),
      accessionNumber: getString('x00080050'),

      // Study details
      modality: getString('x00080060'),
      studyDescription: getString('x00081030'),
      seriesDescription: getString('x0008103e'),
      bodyPartExamined: getString('x00180015'),
      studyDate: getDate('x00080020'),
      studyTime: getString('x00080030'),

      // Patient info (may be anonymized)
      patientName: getString('x00100010'),
      patientId: getString('x00100020'),
      patientBirthDate: getDate('x00100030'),
      patientSex: getString('x00100040'),

      // Equipment
      manufacturer: getString('x00080070'),
      institutionName: getString('x00080080'),
      stationName: getString('x00081010'),
      modelName: getString('x00081090'),

      // Image parameters
      rows: dataset.uint16('x00280010') || null,
      columns: dataset.uint16('x00280011') || null,
      bitsAllocated: dataset.uint16('x00280100') || null,
      bitsStored: dataset.uint16('x00280101') || null,
      photometricInterpretation: getString('x00280004'),
      windowCenter: dataset.floatString('x00281050') || null,
      windowWidth: dataset.floatString('x00281051') || null,

      // Technique
      kvp: dataset.floatString('x00180060') || null,
      exposureTime: dataset.floatString('x00181150') || null,
      tubeCurrent: dataset.floatString('x00181151') || null,
      sliceThickness: dataset.floatString('x00180050') || null,
      spacingBetweenSlices: dataset.floatString('x00180088') || null,
      pixelSpacing: getString('x00280030')
    };
  }

  /**
   * Extract raw pixel data from DICOM dataset
   * @param {Object} dataset - dicomParser DataSet
   * @returns {ArrayBuffer|null} Pixel data
   */
  extractPixelData(dataset) {
    try {
      const pixelDataElement = dataset.elements.x7fe00010;
      if (!pixelDataElement) return null;

      // Return the raw pixel data bytes
      return dataset.byteArray.buffer.slice(
        pixelDataElement.dataOffset,
        pixelDataElement.dataOffset + pixelDataElement.length
      );
    } catch (error) {
      console.error('Failed to extract pixel data:', error.message);
      return null;
    }
  }

  /**
   * Convert DICOM pixel data to JPEG
   * Handles 8/12/16 bit grayscale with window/level adjustment
   *
   * @param {ArrayBuffer} pixelData - Raw pixel data
   * @param {number} width - Image width
   * @param {number} height - Image height
   * @param {number|null} windowCenter - DICOM window center
   * @param {number|null} windowWidth - DICOM window width
   * @param {number} bitsAllocated - Bits per pixel allocated (8, 12, 16)
   * @param {number} bitsStored - Bits per pixel stored
   * @param {number} pixelRepresentation - 0=unsigned, 1=signed
   * @param {string} photometricInterpretation - MONOCHROME1, MONOCHROME2, RGB
   * @returns {Buffer} JPEG image buffer
   */
  convertToJpeg(pixelData, width, height, windowCenter, windowWidth,
                bitsAllocated, bitsStored, pixelRepresentation, photometricInterpretation) {

    const isRgb = photometricInterpretation === 'RGB';
    const isInverted = photometricInterpretation === 'MONOCHROME1';

    // Create RGBA buffer for jpeg-js
    const frameSize = width * height;
    const rgbaData = Buffer.alloc(frameSize * 4);

    if (isRgb) {
      // RGB data — 3 bytes per pixel
      const rgb = new Uint8Array(pixelData);
      for (let i = 0; i < frameSize; i++) {
        rgbaData[i * 4] = rgb[i * 3];        // R
        rgbaData[i * 4 + 1] = rgb[i * 3 + 1]; // G
        rgbaData[i * 4 + 2] = rgb[i * 3 + 2]; // B
        rgbaData[i * 4 + 3] = 255;             // A
      }
    } else {
      // Grayscale — apply windowing
      let pixelArray;
      if (bitsAllocated <= 8) {
        pixelArray = new Uint8Array(pixelData);
      } else if (pixelRepresentation === 1) {
        pixelArray = new Int16Array(pixelData);
      } else {
        pixelArray = new Uint16Array(pixelData);
      }

      // Auto-calculate window if not provided
      let wc = windowCenter;
      let ww = windowWidth;
      if (wc === null || ww === null) {
        let min = Infinity, max = -Infinity;
        const sampleStep = Math.max(1, Math.floor(pixelArray.length / 10000));
        for (let i = 0; i < pixelArray.length; i += sampleStep) {
          if (pixelArray[i] < min) min = pixelArray[i];
          if (pixelArray[i] > max) max = pixelArray[i];
        }
        wc = (min + max) / 2;
        ww = max - min || 1;
      }

      const wcMin = wc - ww / 2;
      const wcMax = wc + ww / 2;
      const range = wcMax - wcMin || 1;

      for (let i = 0; i < frameSize && i < pixelArray.length; i++) {
        let val = pixelArray[i];
        // Apply window/level
        if (val <= wcMin) {
          val = 0;
        } else if (val >= wcMax) {
          val = 255;
        } else {
          val = Math.round(((val - wcMin) / range) * 255);
        }

        // Invert for MONOCHROME1 (bone = dark, air = bright)
        if (isInverted) val = 255 - val;

        rgbaData[i * 4] = val;       // R
        rgbaData[i * 4 + 1] = val;   // G
        rgbaData[i * 4 + 2] = val;   // B
        rgbaData[i * 4 + 3] = 255;   // A
      }
    }

    // Encode to JPEG with quality 90
    const rawImageData = {
      data: rgbaData,
      width,
      height
    };

    const jpegData = jpeg.encode(rawImageData, 90);
    return Buffer.from(jpegData.data);
  }
}

module.exports = new DicomConverterService();
