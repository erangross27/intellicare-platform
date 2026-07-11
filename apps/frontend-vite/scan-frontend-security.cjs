const fs = require('fs');
const path = require('path');
const glob = require('glob');

class FrontendSecurityScanner {
  constructor() {
    this.violations = [];
    this.patterns = {
      localStorage: /localStorage\.(setItem|getItem|removeItem|clear)/g,
      sessionStorage: /sessionStorage\.(setItem|getItem|removeItem|clear)/g,
      innerHTML: /innerHTML\s*=/g,
      documentWrite: /document\.write/g,
      eval: /eval\(/g,
      dangerouslySetInnerHTML: /dangerouslySetInnerHTML/g,
      directAPI: /fetch\(|axios\.|XMLHttpRequest/g,
      hardcodedSecrets: /api[_-]?key|secret|password|token/gi,
      insecureProtocol: /http:\/\/(?!localhost)/g,
      openRedirect: /window\.location\s*=\s*[^'"]/g,
      console: /console\.(log|debug|info|warn|error)/g
    };
  }

  scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath);

    Object.entries(this.patterns).forEach(([type, pattern]) => {
      const matches = content.match(pattern);
      if (matches) {
        this.violations.push({
          file: filePath,
          type,
          count: matches.length,
          severity: this.getSeverity(type)
        });
      }
    });
  }

  getSeverity(type) {
    const critical = ['eval', 'innerHTML', 'hardcodedSecrets', 'directAPI'];
    const high = ['localStorage', 'dangerouslySetInnerHTML', 'openRedirect'];
    const medium = ['sessionStorage', 'insecureProtocol', 'documentWrite'];

    if (critical.includes(type)) return 'CRITICAL';
    if (high.includes(type)) return 'HIGH';
    if (medium.includes(type)) return 'MEDIUM';
    return 'LOW';
  }

  scan() {
    const files = glob.sync('src/**/*.{js,jsx,ts,tsx}');
    files.forEach(file => this.scanFile(file));

    return this.generateReport();
  }

  generateReport() {
    const critical = this.violations.filter(v => v.severity === 'CRITICAL');
    const high = this.violations.filter(v => v.severity === 'HIGH');

    console.log('=== FRONTEND SECURITY SCAN REPORT ===');
    console.log(`Total Violations: ${this.violations.length}`);
    console.log(`Critical: ${critical.length}`);
    console.log(`High: ${high.length}`);
    console.log('\nCritical Issues:');
    critical.forEach(v => {
      console.log(`  ${v.file}: ${v.type} (${v.count} occurrences)`);
    });

    return this.violations;
  }
}

new FrontendSecurityScanner().scan();