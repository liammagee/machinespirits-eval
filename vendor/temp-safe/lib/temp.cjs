'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let tracking = false;
let exitListenerAttached = false;
const filesToDelete = [];
const dirsToDelete = [];

function parseAffixes(rawAffixes, defaultPrefix) {
  if (rawAffixes == null) return { prefix: defaultPrefix, suffix: '', dir: os.tmpdir() };
  if (typeof rawAffixes === 'string') return { prefix: rawAffixes, suffix: '', dir: os.tmpdir() };
  if (typeof rawAffixes !== 'object' || Array.isArray(rawAffixes)) {
    throw new TypeError(`Unknown affix declaration: ${String(rawAffixes)}`);
  }
  return {
    prefix: rawAffixes.prefix == null ? defaultPrefix : String(rawAffixes.prefix),
    suffix: rawAffixes.suffix == null ? '' : String(rawAffixes.suffix),
    dir: rawAffixes.dir == null ? os.tmpdir() : path.resolve(String(rawAffixes.dir)),
  };
}

function generateName(rawAffixes, defaultPrefix = 'f-') {
  const affixes = parseAffixes(rawAffixes, defaultPrefix);
  const stamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, '')
    .slice(0, 14);
  const random = crypto.randomBytes(8).toString('hex');
  return path.join(affixes.dir, `${affixes.prefix}${stamp}-${process.pid}-${random}${affixes.suffix}`);
}

function removeSync(target) {
  fs.rmSync(target, { force: true, recursive: true, maxRetries: 6 });
}

async function remove(target) {
  await fs.promises.rm(target, { force: true, recursive: true, maxRetries: 6 });
}

function cleanupSync() {
  if (!tracking) return false;
  let fileCount = 0;
  let dirCount = 0;
  while (filesToDelete.length) {
    removeSync(filesToDelete.shift());
    fileCount += 1;
  }
  while (dirsToDelete.length) {
    removeSync(dirsToDelete.shift());
    dirCount += 1;
  }
  return { files: fileCount, dirs: dirCount };
}

async function cleanupTracked() {
  if (!tracking) throw new Error('not tracking');
  let fileCount = 0;
  let dirCount = 0;
  while (filesToDelete.length) {
    await remove(filesToDelete.shift());
    fileCount += 1;
  }
  while (dirsToDelete.length) {
    await remove(dirsToDelete.shift());
    dirCount += 1;
  }
  return { files: fileCount, dirs: dirCount };
}

function attachExitListener() {
  if (!tracking || exitListenerAttached) return;
  process.once('exit', cleanupSync);
  exitListenerAttached = true;
}

function track(value = true) {
  tracking = value !== false;
  return module.exports;
}

function remember(target, collection) {
  if (!tracking) return;
  attachExitListener();
  collection.push(target);
}

function settle(promise, callback) {
  if (typeof callback !== 'function') return promise;
  promise.then((value) => callback(null, value), callback);
  return undefined;
}

function mkdir(rawAffixes, callback) {
  if (typeof rawAffixes === 'function') {
    callback = rawAffixes;
    rawAffixes = undefined;
  }
  const dirPath = generateName(rawAffixes, 'd-');
  const promise = fs.promises.mkdir(dirPath, { mode: 0o700 }).then(() => {
    remember(dirPath, dirsToDelete);
    return dirPath;
  });
  return settle(promise, callback);
}

function mkdirSync(rawAffixes) {
  const dirPath = generateName(rawAffixes, 'd-');
  fs.mkdirSync(dirPath, { mode: 0o700 });
  remember(dirPath, dirsToDelete);
  return dirPath;
}

function open(rawAffixes, callback) {
  if (typeof rawAffixes === 'function') {
    callback = rawAffixes;
    rawAffixes = undefined;
  }
  const filePath = generateName(rawAffixes, 'f-');
  const promise = new Promise((resolve, reject) => {
    fs.open(filePath, 'wx+', 0o600, (error, fd) => {
      if (error) {
        reject(error);
        return;
      }
      remember(filePath, filesToDelete);
      resolve({ path: filePath, fd });
    });
  });
  return settle(promise, callback);
}

function openSync(rawAffixes) {
  const filePath = generateName(rawAffixes, 'f-');
  const fd = fs.openSync(filePath, 'wx+', 0o600);
  remember(filePath, filesToDelete);
  return { path: filePath, fd };
}

function createWriteStream(rawAffixes) {
  const filePath = generateName(rawAffixes, 's-');
  const stream = fs.createWriteStream(filePath, { flags: 'wx+', mode: 0o600 });
  remember(filePath, filesToDelete);
  return stream;
}

function cleanup(callback) {
  return settle(cleanupTracked(), callback);
}

exports.dir = path.resolve(os.tmpdir());
exports.track = track;
exports.mkdir = mkdir;
exports.mkdirSync = mkdirSync;
exports.open = open;
exports.openSync = openSync;
exports.path = generateName;
exports.cleanup = cleanup;
exports.cleanupSync = cleanupSync;
exports.createWriteStream = createWriteStream;
