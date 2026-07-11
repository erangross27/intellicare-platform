const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { marked } = require('marked');

const MD_DIR = '/home/erangross/Documents/English medical termplates';
const PDF_DIR = '/home/erangross/Documents/English medical termplates';

// Read all MD files
const mdFiles = fs.readdirSync(MD_DIR).filter(file => file.endsWith('.md'));

console.log(`Found ${mdFiles.length} MD files to convert`);

async function convertMDtoPDF() {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  for (const mdFile of mdFiles) {
    try {
      const mdPath = path.join(MD_DIR, mdFile);
      const pdfPath = path.join(PDF_DIR, mdFile.replace('.md', '.pdf'));

      console.log(`Converting: ${mdFile}`);

      // Read markdown file
      const markdown = fs.readFileSync(mdPath, 'utf-8');

      // Convert markdown to HTML
      const html = marked(markdown);

      // Create styled HTML document
      const styledHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: 'Courier New', 'Monaco', 'Menlo', 'Consolas', monospace;
      font-size: 11pt;
      line-height: 1.4;
      max-width: 800px;
      margin: 20px auto;
      padding: 20px;
      color: #000;
      background: #fff;
    }
    h1 {
      font-size: 20pt;
      font-weight: bold;
      margin-top: 24px;
      margin-bottom: 12px;
      border-bottom: 2px solid #000;
      padding-bottom: 8px;
    }
    h2 {
      font-size: 16pt;
      font-weight: bold;
      margin-top: 20px;
      margin-bottom: 10px;
      border-bottom: 1px solid #666;
      padding-bottom: 4px;
    }
    h3 {
      font-size: 14pt;
      font-weight: bold;
      margin-top: 16px;
      margin-bottom: 8px;
    }
    h4 {
      font-size: 12pt;
      font-weight: bold;
      margin-top: 12px;
      margin-bottom: 6px;
    }
    p {
      margin: 8px 0;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 12px 0;
      font-size: 10pt;
    }
    th, td {
      border: 1px solid #000;
      padding: 6px;
      text-align: left;
    }
    th {
      background-color: #e0e0e0;
      font-weight: bold;
    }
    ul, ol {
      margin: 8px 0;
      padding-left: 24px;
    }
    li {
      margin: 4px 0;
    }
    strong {
      font-weight: bold;
    }
    em {
      font-style: italic;
    }
    code {
      background-color: #f0f0f0;
      padding: 2px 4px;
      font-family: 'Courier New', monospace;
    }
    pre {
      background-color: #f0f0f0;
      padding: 12px;
      overflow-x: auto;
      margin: 12px 0;
    }
    hr {
      border: none;
      border-top: 1px solid #000;
      margin: 16px 0;
    }
    blockquote {
      border-left: 4px solid #666;
      padding-left: 12px;
      margin: 12px 0;
      color: #666;
    }
    .page-break {
      page-break-after: always;
    }
  </style>
</head>
<body>
  ${html}
  <hr style="margin-top: 40px;">
  <p style="font-size: 9pt; color: #666; text-align: center;">
    <em>CONFIDENTIAL PATIENT HEALTH INFORMATION - Protected under HIPAA</em>
  </p>
</body>
</html>
      `;

      const page = await browser.newPage();
      await page.setContent(styledHTML, { waitUntil: 'networkidle0' });

      // Generate PDF
      await page.pdf({
        path: pdfPath,
        format: 'Letter',
        margin: {
          top: '0.5in',
          right: '0.5in',
          bottom: '0.5in',
          left: '0.5in'
        },
        printBackground: true
      });

      await page.close();
      console.log(`✓ Created: ${mdFile.replace('.md', '.pdf')}`);

    } catch (error) {
      console.error(`✗ Error converting ${mdFile}:`, error.message);
    }
  }

  await browser.close();
  console.log(`\n✅ Conversion complete! Created ${mdFiles.length} PDFs`);
}

convertMDtoPDF().catch(console.error);
