/**
 * Playwright PDF Generator
 *
 * Generates PDFs from React components by rendering them in a headless browser.
 * Uses Playwright for better page break control and CSS support.
 */

const { chromium } = require('playwright');
const path = require('path');

/**
 * Generate PDF from HTML string
 * @param {string} html - Complete HTML document string
 * @param {object} options - PDF generation options
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generatePdfFromHtml(html, options = {}) {
  const {
    format = 'A4',
    printBackground = true,
    margin = {
      top: '20mm',
      right: '15mm',
      bottom: '20mm',
      left: '15mm'
    }
  } = options;

  let browser;
  try {
    console.log('🚀 Launching Playwright...');
    // Launch browser
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();

    // Capture console logs from the page
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        console.error('🔴 [Playwright Page Error]:', text);
      } else if (type === 'warning') {
        console.warn('⚠️  [Playwright Page Warning]:', text);
      }
    });

    // Capture page errors
    page.on('pageerror', error => {
      console.error('🔴 [Playwright Page Exception]:', error.message);
    });

    console.log('📄 Setting viewport...');
    // Set viewport for consistent rendering
    await page.setViewportSize({
      width: 1200,
      height: 1600
    });

    console.log('📝 Setting page content... (HTML length:', html.length, ')');
    // Set content
    await page.setContent(html, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // CRITICAL: Emulate print media so page-break CSS rules are respected
    console.log('🖨️  Emulating print media type...');
    await page.emulateMedia({ media: 'print' });

    // Inject script to manually add page breaks before cards that won't fit
    console.log('📏 Calculating page breaks...');
    await page.evaluate(() => {
      // A4 dimensions: 210mm x 297mm at 96 DPI
      // Margins: 15mm top, 20mm bottom = 35mm total vertical margin
      // Usable height: 297mm - 35mm = 262mm = 992px at 96 DPI
      const pageHeight = 992;
      const cards = document.querySelectorAll('.card, .detail-card, .ai-section');

      let currentY = 0;

      cards.forEach((card, index) => {
        const rect = card.getBoundingClientRect();
        const cardHeight = card.scrollHeight; // Use scrollHeight for accurate measurement

        // Calculate where we are on the current page
        const yOnPage = currentY % pageHeight;

        // If card won't fit on current page (with 50px buffer), force page break
        if (yOnPage + cardHeight > pageHeight - 50 && yOnPage > 50) {
          // Add page break before this card
          card.style.pageBreakBefore = 'always !important';
          card.style.breakBefore = 'page !important';

          // Reset to top of new page
          currentY = Math.ceil(currentY / pageHeight) * pageHeight;
          console.log(`Card ${index}: Forced page break (height: ${cardHeight}px, was at: ${yOnPage}px)`);
        }

        currentY += cardHeight;
      });

      console.log(`Total pages estimated: ${Math.ceil(currentY / pageHeight)}`);
    });

    console.log('📄 Generating PDF...');
    // Generate PDF with Playwright
    const pdfBuffer = await page.pdf({
      format,
      printBackground,
      margin,
      preferCSSPageSize: false
    });

    console.log('✅ PDF generated, buffer size:', pdfBuffer.length);
    return pdfBuffer;
  } catch (error) {
    console.error('Puppeteer PDF generation error:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Build complete HTML document from React component HTML
 * @param {string} componentHtml - Rendered React component HTML
 * @param {string} cssContent - CSS styles as string
 * @returns {string} Complete HTML document
 */
function buildHtmlDocument(componentHtml, cssContent = '') {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Medical Document</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Courier New', 'Monaco', 'Menlo', 'Consolas', monospace;
      font-size: 10pt;
      line-height: 1.3;
      color: #000;
      background: #fff;
    }

    /* Page setup for better break control */
    @page {
      size: A4;
      margin: 15mm;
    }

    /* Inject component-specific CSS */
    ${cssContent}

    /* PDF-specific overrides (apply immediately, not just for @media print) */
    * {
      background: #fff !important;
      color: #000 !important;
      border-color: #333 !important;
    }

    .allergy-immunology-document,
    .ai-document-header,
    .ai-section,
    .doc-section,
    .chief-complaint-card,
    .card,
    .detail-card,
    section,
    div,
    p {
      background: #fff !important;
      background-color: #fff !important;
      color: #000 !important;
    }

    /* Ensure text is readable */
    h1, h2, h3, h4, h5, h6, p, span, div, li, td, th, strong, em, a {
      color: #000 !important;
    }

    /* Field labels and values */
    .field-label,
    .field-value {
      color: #000 !important;
    }

    /* Prevent page breaks in the middle of content */
    .card,
    .detail-card,
    .ai-section,
    section,
    .field-row,
    h1, h2, h3, h4, h5, h6,
    p {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      overflow: visible !important;
    }

    /* More aggressive orphan/widow control */
    p, li, .field-row {
      orphans: 3 !important;
      widows: 3 !important;
    }

    /* Cards - NO BORDERS for PDF to hide page breaks */
    .card,
    .detail-card {
      page-break-inside: avoid !important;
      -webkit-region-break-inside: avoid !important;
      break-inside: avoid !important;
      page-break-before: auto !important;
      page-break-after: auto !important;
      display: block !important;
      margin-bottom: 16px !important;
      padding: 0 !important;
      border: none !important;
      border-left: 3px solid #4a5568 !important;
      padding-left: 12px !important;
      font-size: 9pt !important;
      line-height: 1.4 !important;
    }

    /* Compact field rows */
    .field-row {
      margin-bottom: 2px !important;
      padding: 1px 0 !important;
    }

    /* Compact section titles */
    .section-title,
    h2 {
      margin-top: 8px !important;
      margin-bottom: 6px !important;
      font-size: 14pt !important;
    }

    h3, .card-title {
      margin-top: 4px !important;
      margin-bottom: 4px !important;
      font-size: 11pt !important;
    }

    /* Sections should try to stay together */
    .ai-section,
    section {
      page-break-inside: auto !important;
      break-inside: auto !important;
    }

    /* Section headers should stay with their content */
    h1, h2, h3, h4, h5, h6 {
      page-break-after: avoid !important;
      break-after: avoid !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    /* Keep severity colors but make them PDF-friendly */
    .severity-high, .severity-critical {
      border-left: 4px solid #dc2626 !important;
      background: #fee2e2 !important;
    }

    .severity-moderate, .severity-important {
      border-left: 4px solid #ea580c !important;
      background: #ffedd5 !important;
    }

    .severity-low, .severity-routine {
      border-left: 4px solid #10b981 !important;
      background: #d1fae5 !important;
    }

    /* Hide any remaining interactive elements */
    button, .search-bar, .action-btn, .no-print {
      display: none !important;
    }

    /* Print-specific styles */
    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }

      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  ${componentHtml}
</body>
</html>
  `.trim();
}

module.exports = {
  generatePdfFromHtml,
  buildHtmlDocument
};
