#!/usr/bin/env node
// Injects the build version into package.json before electron-builder runs.
// Version source (in order):
//   1. $BUILD_VERSION           (set by CI from the git tag)
//   2. git tag pointing at HEAD (local build on a tagged commit)
//   3. latest tag + -dev.<n>    (local build between tags)
//   4. current package.json     (no git / no tags — keep as-is)
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const git = (cmd) =>
  execSync('git ' + cmd, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
    .toString()
    .trim();

let version = (process.env.BUILD_VERSION || '').trim();
if (!version) {
  try {
    version = git('describe --tags --exact-match').replace(/^v/, '');
  } catch (e) {
    try {
      const base = git('describe --tags --abbrev=0').replace(/^v/, '');
      const n = git('rev-list --count HEAD');
      version = base + '-dev.' + n;
    } catch (e2) {
      version = '';
    }
  }
}

// electron-builder / NSIS require strict x.y.z[-prerelease]
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  version = pkg.version;
  console.log('[set-version] no usable git tag, keeping ' + version);
}

if (pkg.version !== version) {
  pkg.version = version;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
}
console.log('[set-version] version = ' + version);
