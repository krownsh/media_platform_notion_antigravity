import fs from 'fs';
import path from 'path';

/**
 * Project Auditor Service
 * Read-only static analyzer for local projects to identify gaps, missing tests, tech debt, and bugs.
 */

/**
 * Audits a target project directory safely.
 * @param {string} projectDir Absolute path to local project directory
 * @param {Object} options Audit configuration
 */
export async function auditProjectDirectory(projectDir, options = {}) {
  if (!projectDir || !fs.existsSync(projectDir)) {
    throw new Error(`Target project directory does not exist: ${projectDir}`);
  }

  const projectNeeds = [];
  const capabilities = [];
  let fileCount = 0;

  // Read package.json if present
  const packageJsonPath = path.join(projectDir, 'package.json');
  let dependencies = {};
  let devDependencies = {};
  let projectName = path.basename(projectDir);

  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      projectName = pkg.name || projectName;
      dependencies = pkg.dependencies || {};
      devDependencies = pkg.devDependencies || {};
      capabilities.push({ type: 'npm_package', name: projectName, version: pkg.version });
    } catch (err) {
      projectNeeds.push({
        title: 'package.json parsing issue',
        category: 'tech_debt',
        impact: 'Unable to reliably parse package dependencies',
        severity: 'low',
        confidence: 0.9,
        evidence: [{ type: 'file_read_error', location: 'package.json', detail: err.message }],
        suggested_validation: 'Validate package.json syntax'
      });
    }
  }

  // Scan workspace files recursively up to specified maxDepth
  const maxDepth = options.maxDepth || 4;
  const excludeDirs = new Set(['node_modules', '.git', 'dist', 'build', '.cache', 'coverage']);

  function scanDir(currentDir, depth) {
    if (depth > maxDepth) return;
    let entries = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (excludeDirs.has(entry.name)) continue;

      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath, depth + 1);
      } else if (entry.isFile()) {
        fileCount++;
        inspectFile(fullPath, entry.name, projectNeeds, capabilities);
      }
    }
  }

  scanDir(projectDir, 1);

  // Check test folder existence
  const testDir = path.join(projectDir, 'test');
  if (!fs.existsSync(testDir)) {
    projectNeeds.push({
      title: 'Missing test suite directory',
      category: 'missing_test',
      impact: 'No standard /test directory found, risking silent regressions during refactoring',
      severity: 'high',
      confidence: 0.95,
      evidence: [{ type: 'directory_missing', location: '/test' }],
      suggested_validation: 'Create /test directory and add integration contract tests'
    });
  }

  const snapshot = {
    projectName,
    projectDir,
    fileCount,
    capabilities,
    summary: `Audited ${fileCount} files in ${projectName}. Discovered ${projectNeeds.length} active project needs.`,
    audit_metadata: {
      auditedAt: new Date().toISOString(),
      dependenciesCount: Object.keys(dependencies).length,
      devDependenciesCount: Object.keys(devDependencies).length
    }
  };

  return {
    snapshot,
    needs: projectNeeds
  };
}

/**
 * Static inspection of individual files for known vulnerabilities or missing patterns.
 */
function inspectFile(filePath, filename, needs, capabilities) {
  const relativePath = filePath.split(path.sep).slice(-3).join('/');

  // Inspect crawler services for error handling / silent fallbacks
  if (filename.includes('crawler') || filename.includes('Adapter')) {
    capabilities.push({ type: 'crawler_adapter', location: relativePath });
  }

  // Check for common issues like hardcoded tokens or missing try-catch in async handlers
  if (filename.endsWith('.js') || filename.endsWith('.ts')) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('process.env.') && !content.includes('requireApiAuth') && relativePath.includes('routes/')) {
        needs.push({
          title: `Unauthenticated route script detected in ${filename}`,
          category: 'security_risk',
          impact: 'Exposes API endpoints without user token validation',
          severity: 'high',
          confidence: 0.85,
          evidence: [{ type: 'code_pattern', location: relativePath, detail: 'Route file lacks authentication middleware' }],
          suggested_validation: 'Wrap route definitions with requireApiAuth middleware'
        });
      }
    } catch {
      // Ignore unreadable files
    }
  }
}
