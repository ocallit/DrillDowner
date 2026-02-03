/**
 * coverage-runner.js
 * Runs QUnit tests with V8 coverage collection and generates HTML report
 * 
 * Usage: node test/coverage-runner.js
 */

const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8090;
const ROOT_DIR = path.join(__dirname, '..');
const TEST_URL = `http://localhost:${PORT}/test/drilldowner_tests.html`;
const COVERAGE_DIR = path.join(ROOT_DIR, 'coverage');
const NYC_OUTPUT_DIR = path.join(ROOT_DIR, '.nyc_output');

// Simple static file server
function createServer() {
    return http.createServer((req, res) => {
        let urlPath = req.url.split('?')[0];
        let filePath = path.join(ROOT_DIR, urlPath);
        
        const ext = path.extname(filePath);
        const contentTypes = {
            '.html': 'text/html; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.json': 'application/json',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.ico': 'image/x-icon'
        };
        
        fs.readFile(filePath, (err, content) => {
            if (err) {
                if (!urlPath.includes('favicon')) {
                    console.log(`  404: ${urlPath}`);
                }
                res.writeHead(404);
                res.end(`File not found: ${urlPath}`);
                return;
            }
            
            res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
            res.end(content);
        });
    });
}

// Generate HTML coverage report
function generateHtmlReport(sourceCode, lineCoverage, coveragePercent, coveredLines, totalLines) {
    const lines = sourceCode.split('\n');
    
    let sourceHtml = '';
    lines.forEach((line, i) => {
        const lineNum = i + 1;
        const covered = lineCoverage[i];
        const escapedLine = line
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        
        const bgColor = covered ? '#e6ffe6' : (line.trim() === '' || line.trim().startsWith('//') ? '#fff' : '#ffe6e6');
        const marker = covered ? '✓' : (line.trim() === '' || line.trim().startsWith('//') ? ' ' : '✗');
        
        sourceHtml += `<tr style="background:${bgColor}">
            <td style="text-align:right;padding:0 8px;color:#666;border-right:1px solid #ddd;user-select:none">${lineNum}</td>
            <td style="text-align:center;width:20px;color:${covered ? 'green' : 'red'}">${marker}</td>
            <td><pre style="margin:0;font-family:Consolas,monospace;font-size:13px">${escapedLine || ' '}</pre></td>
        </tr>`;
    });
    
    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Coverage Report - DrillDowner.js</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .summary h1 { margin: 0 0 10px 0; }
        .meter { background: #ddd; border-radius: 4px; height: 24px; overflow: hidden; }
        .meter-fill { background: ${coveragePercent >= 80 ? '#4caf50' : coveragePercent >= 60 ? '#ff9800' : '#f44336'}; height: 100%; transition: width 0.3s; }
        .stats { display: flex; gap: 30px; margin-top: 15px; }
        .stat { text-align: center; }
        .stat-value { font-size: 24px; font-weight: bold; }
        .stat-label { color: #666; font-size: 14px; }
        table { border-collapse: collapse; width: 100%; }
        tr:hover { background: #f0f0f0 !important; }
        .file-header { background: #333; color: #fff; padding: 10px 15px; border-radius: 8px 8px 0 0; }
    </style>
</head>
<body>
    <div class="summary">
        <h1>Coverage Report</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
        <div class="meter">
            <div class="meter-fill" style="width: ${coveragePercent}%"></div>
        </div>
        <div class="stats">
            <div class="stat">
                <div class="stat-value">${coveragePercent}%</div>
                <div class="stat-label">Lines Covered</div>
            </div>
            <div class="stat">
                <div class="stat-value">${coveredLines}</div>
                <div class="stat-label">Covered</div>
            </div>
            <div class="stat">
                <div class="stat-value">${totalLines - coveredLines}</div>
                <div class="stat-label">Uncovered</div>
            </div>
            <div class="stat">
                <div class="stat-value">${totalLines}</div>
                <div class="stat-label">Total Lines</div>
            </div>
        </div>
    </div>
    
    <div class="file-header">src/DrillDowner.js</div>
    <table>
        ${sourceHtml}
    </table>
</body>
</html>`;
    
    return html;
}

async function runTests() {
    // Ensure directories exist
    [COVERAGE_DIR, NYC_OUTPUT_DIR].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
    
    const server = createServer();
    await new Promise(resolve => server.listen(PORT, resolve));
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Loading: ${TEST_URL}\n`);
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Start V8 coverage
        await page.coverage.startJSCoverage({ includeRawScriptCoverage: true });
        
        // Log errors (skip favicon)
        page.on('console', msg => {
            if (msg.type() === 'error' && !msg.text().includes('favicon')) {
                console.error('Browser:', msg.text());
            }
        });
        
        page.on('pageerror', err => {
            console.error('Page error:', err.message);
        });
        
        await page.goto(TEST_URL, { waitUntil: 'networkidle0', timeout: 60000 });
        
        // Wait for QUnit to finish
        const results = await page.evaluate(() => {
            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    if (typeof QUnit !== 'undefined' && QUnit.config) {
                        const stats = QUnit.config.stats || {};
                        resolve({
                            passed: stats.all - (stats.bad || 0),
                            failed: stats.bad || 0,
                            total: stats.all || 0,
                            runtime: 'timeout'
                        });
                    } else {
                        resolve({ error: 'QUnit timeout', passed: 0, failed: 0, total: 0 });
                    }
                }, 15000);
                
                if (typeof QUnit === 'undefined') {
                    clearTimeout(timeout);
                    resolve({ error: 'QUnit not found', passed: 0, failed: 0, total: 0 });
                    return;
                }
                
                QUnit.done(details => {
                    clearTimeout(timeout);
                    resolve({
                        passed: details.passed,
                        failed: details.failed,
                        total: details.total,
                        runtime: details.runtime
                    });
                });
                
                // Check if already complete
                setTimeout(() => {
                    if (QUnit.config && QUnit.config.stats && QUnit.config.stats.all > 0) {
                        const el = document.querySelector('#qunit-testresult');
                        if (el && el.textContent.includes('completed')) {
                            clearTimeout(timeout);
                            const stats = QUnit.config.stats;
                            resolve({
                                passed: stats.all - (stats.bad || 0),
                                failed: stats.bad || 0,
                                total: stats.all,
                                runtime: 'completed'
                            });
                        }
                    }
                }, 2000);
            });
        });
        
        // Print test results
        console.log('╔══════════════════════════════════════╗');
        console.log('║          QUnit Test Results          ║');
        console.log('╠══════════════════════════════════════╣');
        if (results.error) {
            console.log(`║  ERROR: ${results.error.padEnd(28)}║`);
        } else {
            console.log(`║  Passed:  ${String(results.passed).padEnd(26)}║`);
            console.log(`║  Failed:  ${String(results.failed).padEnd(26)}║`);
            console.log(`║  Total:   ${String(results.total).padEnd(26)}║`);
            if (results.runtime !== undefined) {
                const runtimeStr = typeof results.runtime === 'number' ? results.runtime + 'ms' : String(results.runtime);
                console.log(`║  Runtime: ${runtimeStr.padEnd(26)}║`);
            }
        }
        console.log('╚══════════════════════════════════════╝\n');
        
        // Stop and get V8 coverage
        const coverage = await page.coverage.stopJSCoverage();
        
        // Find DrillDowner.js coverage
        const ddCoverage = coverage.find(entry => 
            entry.url.includes('DrillDowner.js') && 
            !entry.url.includes('.min.') &&
            !entry.url.includes('node_modules')
        );
        
        if (ddCoverage) {
            const sourceCode = ddCoverage.text;
            const lines = sourceCode.split('\n');
            const totalLines = lines.length;
            
            // Build line coverage map
            const lineCoverage = new Array(totalLines).fill(false);
            let charIndex = 0;
            
            lines.forEach((line, lineIndex) => {
                const lineStart = charIndex;
                const lineEnd = charIndex + line.length;
                
                for (const range of ddCoverage.ranges) {
                    if (range.start < lineEnd && range.end > lineStart) {
                        lineCoverage[lineIndex] = true;
                        break;
                    }
                }
                
                charIndex = lineEnd + 1;
            });
            
            const coveredLines = lineCoverage.filter(Boolean).length;
            const coveragePercent = ((coveredLines / totalLines) * 100).toFixed(1);
            
            console.log('╔══════════════════════════════════════╗');
            console.log('║         Coverage Summary             ║');
            console.log('╠══════════════════════════════════════╣');
            console.log(`║  File: DrillDowner.js                ║`);
            console.log(`║  Lines:     ${coveredLines}/${totalLines} (${coveragePercent}%)`.padEnd(39) + '║');
            console.log('╚══════════════════════════════════════╝\n');
            
            // Find uncovered lines (skip empty/comments)
            const uncovered = [];
            lineCoverage.forEach((covered, i) => {
                if (!covered) {
                    const line = lines[i].trim();
                    if (line && !line.startsWith('//') && !line.startsWith('*') && line !== '{' && line !== '}') {
                        uncovered.push({ line: i + 1, code: lines[i].substring(0, 70) });
                    }
                }
            });
            
            if (uncovered.length > 0 && uncovered.length <= 15) {
                console.log('Uncovered lines:');
                uncovered.forEach(u => console.log(`  ${u.line}: ${u.code}`));
                console.log('');
            } else if (uncovered.length > 15) {
                console.log(`${uncovered.length} lines not covered (showing first 10):`);
                uncovered.slice(0, 10).forEach(u => console.log(`  ${u.line}: ${u.code}`));
                console.log('');
            }
            
            // Generate HTML report
            const htmlReport = generateHtmlReport(sourceCode, lineCoverage, coveragePercent, coveredLines, totalLines);
            fs.writeFileSync(path.join(COVERAGE_DIR, 'index.html'), htmlReport);
            console.log(`HTML report: ${path.join(COVERAGE_DIR, 'index.html')}`);
            
            // Save JSON summary
            const summary = {
                file: 'DrillDowner.js',
                totalLines,
                coveredLines,
                coveragePercent: parseFloat(coveragePercent),
                uncoveredLines: uncovered.map(u => u.line),
                generated: new Date().toISOString()
            };
            
            fs.writeFileSync(path.join(NYC_OUTPUT_DIR, 'coverage-summary.json'), JSON.stringify(summary, null, 2));
            
        } else {
            console.log('Warning: DrillDowner.js coverage not found');
        }
        
        if (results.failed > 0) {
            process.exitCode = 1;
        }
        
    } finally {
        await browser.close();
        server.close();
        console.log('\nDone.');
    }
}

runTests().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
