#!/usr/bin/env node
/*
 * commit_135_individual.js
 *
 * Purpose: Commit each currently changed file as a separate commit with
 * proper attribution to nishchith-m10. Creates individual commits for
 * each modified/new file to maximize GitHub contribution count for
 * the Brand-Infinity-Engine repository.
 *
 * Usage:
 *   node scripts/commit_135_individual.js              # dry-run mode
 *   node scripts/commit_135_individual.js --confirm    # actually commit and push
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DRY_RUN = !process.argv.includes('--confirm');
const GIT_AUTHOR_NAME = 'nishchith-m10';
const GIT_AUTHOR_EMAIL = 'nishchith-m10@users.noreply.github.com';
const ROOT = path.resolve(__dirname, '..');

function run(cmd, options = {}) {
  try {
    return execSync(cmd, {
      cwd: ROOT,
      stdio: options.silent ? 'pipe' : 'inherit',
      encoding: 'utf8'
    }).toString().trim();
  } catch (err) {
    if (options.ignoreError) {
      return '';
    }
    throw err;
  }
}

function getChangedFiles() {
  const output = run('git status --porcelain', { silent: true });
  if (!output) return [];

  return output
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      const status = line.substring(0, 2);
      const filePath = line.substring(3).trim();
      return { status, filePath };
    })
    .filter(item => {
      // Skip certain files
      if (item.filePath.includes('node_modules/')) return false;
      if (item.filePath.includes('.next/')) return false;
      if (item.filePath === '.DS_Store') return false;
      if (item.filePath.includes('tmp_secret_scan_output/')) return false;
      if (item.filePath.startsWith('logs/')) return false;
      return true;
    });
}

function generateCommitMessage(filePath, status) {
  const ext = path.extname(filePath);
  const basename = path.basename(filePath, ext);
  const dir = path.dirname(filePath);

  // Determine change type
  let changeType = 'chore';
  let action = 'update';

  if (status.includes('D')) {
    changeType = 'chore';
    action = 'remove';
  } else if (status.includes('?')) {
    action = 'add';
  }

  // Determine scope from file type and path - Brand-Infinity-Engine specific patterns
  if (filePath.startsWith('components/') && filePath.endsWith('.tsx')) {
    changeType = 'feat';
    return `${changeType}: ${action} ${basename} component`;
  } else if (filePath.startsWith('lib/') && filePath.endsWith('.ts')) {
    if (filePath.includes('/api/')) {
      changeType = 'feat';
      return `${changeType}: ${action} ${basename} API utility`;
    } else if (filePath.includes('/auth/')) {
      changeType = 'feat';
      return `${changeType}: ${action} ${basename} auth utility`;
    } else if (filePath.includes('/database/')) {
      changeType = 'feat';
      return `${changeType}: ${action} ${basename} database utility`;
    } else if (filePath.includes('/pipeline/')) {
      changeType = 'feat';
      return `${changeType}: ${action} ${basename} pipeline utility`;
    } else if (filePath.includes('/budget/')) {
      changeType = 'feat';
      return `${changeType}: ${action} ${basename} budget utility`;
    } else {
      changeType = 'refactor';
      return `${changeType}: ${action} ${basename} utility`;
    }
  } else if (filePath.startsWith('app/api/') && filePath.endsWith('/route.ts')) {
    changeType = 'feat';
    const routeName = filePath.split('/')[2];
    return `${changeType}: ${action} ${routeName} API route`;
  } else if (filePath.startsWith('app/') && filePath.endsWith('/page.tsx')) {
    changeType = 'feat';
    const pageName = filePath.split('/')[1];
    return `${changeType}: ${action} ${pageName} page`;
  } else if (filePath.startsWith('tests/') || filePath.includes('test')) {
    changeType = 'test';
    if (filePath.includes('integration/')) {
      return `${changeType}: ${action} integration tests`;
    } else if (filePath.includes('unit/')) {
      return `${changeType}: ${action} unit tests`;
    } else {
      return `${changeType}: ${action} ${basename} tests`;
    }
  } else if (filePath.startsWith('docs/') || filePath.startsWith('docs/')) {
    changeType = 'docs';
    if (filePath.includes('api/')) {
      return `${changeType}: ${action} API documentation`;
    } else if (filePath.includes('plans/')) {
      return `${changeType}: ${action} implementation plans`;
    } else {
      return `${changeType}: ${action} ${basename}`;
    }
  } else if (filePath.startsWith('supabase/migrations/')) {
    changeType = 'feat';
    return `${changeType}: ${action} database migration`;
  } else if (filePath.startsWith('supabase/functions/')) {
    changeType = 'feat';
    return `${changeType}: ${action} Supabase function`;
  } else if (filePath.startsWith('scripts/')) {
    changeType = 'chore';
    return `${changeType}: ${action} ${basename} script`;
  } else if (ext === '.sql') {
    changeType = 'feat';
    return `${changeType}: ${action} database schema`;
  } else if (filePath === 'package.json' || filePath === 'package-lock.json') {
    changeType = 'chore';
    return `${changeType}: update dependencies`;
  } else if (filePath === 'middleware.ts') {
    changeType = 'feat';
    return `${changeType}: ${action} middleware`;
  } else if (ext === '.md') {
    changeType = 'docs';
    return `${changeType}: ${action} ${basename}`;
  } else if (ext === '.css' || ext === '.scss') {
    changeType = 'style';
    return `${changeType}: ${action} ${basename} styles`;
  } else if (ext === '.env') {
    changeType = 'chore';
    return `${changeType}: ${action} environment configuration`;
  } else if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
    return `${changeType}: ${action} ${filePath.replace(/^src\//, '').replace(/^lib\//, '').replace(/^app\//, '')}`;
  }

  return `${changeType}: ${action} ${path.basename(filePath)}`;
}

function scanForSecrets(content) {
  const patterns = [
    { name: 'RSA PRIVATE KEY', re: /-----BEGIN[\s\S]*PRIVATE KEY-----/g },
    { name: 'API Key', re: /[aA][pP][iI][_-]?[kK][eE][yY][\s:=]["']?[A-Za-z0-9-_]{32,}/g },
    { name: 'Slack Token', re: /xox[baprs]-[A-Za-z0-9-]+/g },
    { name: 'AWS Key', re: /AKIA[0-9A-Z]{16}/g },
    { name: 'Database URL', re: /[dD][aA][tT][aA][bB][aA][sS][eE][_]?[uU][rR][lL][\s:=]["'][^"'\s]+/g },
    { name: 'Generic Secret', re: /[sS][eE][cC][rR][eE][tT][\s:=]["'][A-Za-z0-9-_]{20,}/g },
    { name: 'Token', re: /[tT][oO][kK][eE][nN][\s:=]["'][A-Za-z0-9-_]{20,}/g },
  ];

  const matches = [];
  for (const pattern of patterns) {
    const found = content.match(pattern.re);
    if (found) {
      matches.push(...found.map(m => ({ type: pattern.name, match: m.slice(0, 50) })));
    }
  }
  return matches;
}

async function main() {
  console.log('='.repeat(70));
  console.log('Individual Commit Script for 135 Changes - Brand-Infinity-Engine');
  console.log('Author: nishchith-m10');
  console.log('Repository: https://github.com/nishchith-m1015/Marketing-Content-Engine');
  console.log('Mode:', DRY_RUN ? 'DRY RUN' : 'LIVE');
  console.log('='.repeat(70));
  console.log();

  // Check we're on main branch
  const currentBranch = run('git branch --show-current', { silent: true });
  if (currentBranch !== 'main') {
    console.error(`❌ Not on main branch. Current branch: ${currentBranch}`);
    console.error('Please switch to main branch first: git checkout main');
    process.exit(1);
  }

  const changedFiles = getChangedFiles();

  if (changedFiles.length === 0) {
    console.log('✓ No changes to commit. Working tree is clean.');
    return;
  }

  console.log(`📋 Found ${changedFiles.length} changed files\n`);

  let committed = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < changedFiles.length; i++) {
    const { status, filePath } = changedFiles[i];
    const commitMessage = generateCommitMessage(filePath, status);

    console.log(`\n[${i + 1}/${changedFiles.length}] ${filePath}`);
    console.log(`    Status: ${status.trim()}`);
    console.log(`    Message: ${commitMessage}`);

    // For deleted files, just stage and commit
    if (status.includes('D')) {
      if (!DRY_RUN) {
        try {
          run(`git add "${filePath.replace(/"/g, '\\"')}"`, { silent: true });
          const escapedMessage = commitMessage.replace(/"/g, '\\"');
          run(`git -c user.name="${GIT_AUTHOR_NAME}" -c user.email="${GIT_AUTHOR_EMAIL}" commit -m "${escapedMessage}"`, { silent: true });
          run('git push origin main', { silent: true });
          console.log('    ✓ Committed and pushed');
          committed++;
        } catch (err) {
          console.log(`    ❌ FAIL: ${err.message}`);
          failed++;
        }
      } else {
        console.log('    [DRY RUN] Would commit deletion');
        committed++;
      }
      continue;
    }

    // Check if file exists
    const absPath = path.join(ROOT, filePath);
    if (!fs.existsSync(absPath)) {
      console.log('    ⚠️  SKIP: File not found');
      skipped++;
      continue;
    }

    // Scan for secrets
    try {
      const content = fs.readFileSync(absPath, 'utf8');
      const secrets = scanForSecrets(content);

      if (secrets.length > 0) {
        console.log('    🔒 SKIP: Potential secrets detected');
        secrets.slice(0, 2).forEach(s => {
          console.log(`        - ${s.type}: ${s.match}...`);
        });
        skipped++;
        continue;
      }
    } catch (err) {
      console.log(`    ⚠️  Warning: Could not scan file: ${err.message}`);
    }

    // Stage, commit, and push
    if (!DRY_RUN) {
      try {
        run(`git add "${filePath.replace(/"/g, '\\"')}"`, { silent: true });
        console.log('    ✓ Staged');

        const escapedMessage = commitMessage.replace(/"/g, '\\"');
        run(`git -c user.name="${GIT_AUTHOR_NAME}" -c user.email="${GIT_AUTHOR_EMAIL}" commit -m "${escapedMessage}"`, { silent: true });
        console.log('    ✓ Committed');

        run('git push origin main', { silent: true });
        console.log('    ✓ Pushed');

        committed++;
      } catch (err) {
        console.log(`    ❌ FAIL: ${err.message}`);
        failed++;
      }
    } else {
      console.log('    [DRY RUN] Would stage, commit, and push');
      committed++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total files processed: ${changedFiles.length}`);
  console.log(`✓ Commits created: ${committed}`);
  console.log(`⚠️  Skipped: ${skipped}`);
  console.log(`❌ Failed: ${failed}`);
  console.log();

  if (DRY_RUN) {
    console.log('🔍 This was a DRY RUN - no changes were made');
    console.log('');
    console.log('To actually commit and push these changes, run:');
    console.log('  node scripts/commit_135_individual.js --confirm');
  } else {
    console.log(`✅ Done! Created ${committed} individual commits`);
    console.log(`These will appear as ${committed} separate contributions for ${GIT_AUTHOR_NAME}`);
    console.log('on the Brand-Infinity-Engine repository.');
  }

  console.log('\n' + '='.repeat(70));

  if (failed > 0 && !DRY_RUN) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n❌ Script failed:', err.message || err);
  console.error(err.stack);
  process.exit(1);
});
