#!/usr/bin/env node
/**
 * Postbuild Guard: Check Client Bundle for Forbidden Strings
 *
 * Purpose: Ensure client bundles never contain direct database table references
 * that should only be accessed via API routes or server-side code.
 *
 * Usage: npm run postbuild (runs automatically after build)
 *
 * Exit codes:
 * - 0: Success (no forbidden strings found)
 * - 1: Failure (forbidden strings detected or error)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const FORBIDDEN_STRINGS = [
  'user_survey_responses',
  'partnership_members', // Add more sensitive table names as needed
];

const CHUNKS_DIR = path.join(__dirname, '../.next/static/chunks');
const EXCLUDED_PATTERNS = [
  /\.map$/,  // Source maps are OK
  /server/i, // Server chunks are OK
];

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

/**
 * Recursively find all JavaScript files in a directory
 */
function findJsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findJsFiles(filePath, fileList);
    } else if (file.endsWith('.js')) {
      // Check if file should be excluded
      const shouldExclude = EXCLUDED_PATTERNS.some(pattern =>
        pattern.test(filePath)
      );

      if (!shouldExclude) {
        fileList.push(filePath);
      }
    }
  });

  return fileList;
}

/**
 * Search for forbidden strings in a file
 */
function searchFile(filePath, forbiddenStrings) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const found = [];

  forbiddenStrings.forEach(str => {
    if (content.includes(str)) {
      // Count occurrences
      const regex = new RegExp(str, 'g');
      const matches = content.match(regex);
      const count = matches ? matches.length : 0;

      found.push({
        string: str,
        count: count,
      });
    }
  });

  return found;
}

/**
 * Main execution
 */
function main() {
  log('\n' + '='.repeat(60), 'bold');
  log('Postbuild Guard: Checking Client Bundles', 'bold');
  log('='.repeat(60) + '\n', 'bold');

  // Check if chunks directory exists
  if (!fs.existsSync(CHUNKS_DIR)) {
    logError(`Chunks directory not found: ${CHUNKS_DIR}`);
    logError('Did you run "npm run build" first?');
    process.exit(1);
  }

  logInfo(`Scanning directory: ${CHUNKS_DIR}`);
  logInfo(`Forbidden strings: ${FORBIDDEN_STRINGS.join(', ')}`);
  console.log('');

  // Find all JS files
  const jsFiles = findJsFiles(CHUNKS_DIR);
  logInfo(`Found ${jsFiles.length} JavaScript files to scan`);
  console.log('');

  // Search each file
  let violations = [];

  jsFiles.forEach(filePath => {
    const found = searchFile(filePath, FORBIDDEN_STRINGS);

    if (found.length > 0) {
      violations.push({
        file: path.relative(process.cwd(), filePath),
        findings: found,
      });
    }
  });

  // Report results
  if (violations.length === 0) {
    logSuccess('No forbidden strings found in client bundles!');
    log('='.repeat(60), 'bold');
    process.exit(0);
  }

  // Violations found
  log('\n' + '⚠️  VIOLATIONS DETECTED'.padStart(40), 'red');
  log('='.repeat(60) + '\n', 'red');

  violations.forEach((violation, index) => {
    logError(`\n[${index + 1}] File: ${violation.file}`);
    violation.findings.forEach(finding => {
      console.log(`    String: "${finding.string}" (${finding.count} occurrence${finding.count > 1 ? 's' : ''})`);
    });
  });

  console.log('');
  log('='.repeat(60), 'red');
  logError('Build FAILED: Client bundles contain forbidden database references');
  log('='.repeat(60), 'red');

  console.log('\n📖 Why this matters:');
  console.log('   Client bundles should NEVER contain direct database table names.');
  console.log('   This indicates code that makes direct Supabase queries from the browser,');
  console.log('   which can fail with 400 errors due to RLS policies or security restrictions.\n');

  console.log('💡 How to fix:');
  console.log('   1. Move database queries to API routes (app/api/**/route.ts)');
  console.log('   2. Use server actions or server components for database access');
  console.log('   3. Client components should fetch data via API routes\n');

  console.log('📄 See PHASE_0_ROOT_CAUSE_REPORT.md for details\n');

  process.exit(1);
}

// Run the guard
main();
