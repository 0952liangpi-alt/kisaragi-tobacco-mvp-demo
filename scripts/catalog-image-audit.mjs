import {createHash} from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import {basename, extname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1];
};
const uploadRoot = option('--uploads-root');
const shouldWrite = args.includes('--write');
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);

await import(new URL('../world-tobacco-japan.js', import.meta.url));
await import(new URL('../catalog-core.js', import.meta.url));

const catalog = globalThis.KISARAGI_CANONICAL_CATALOG;
const registry = globalThis.KISARAGI_ASSET_REGISTRY;
const audit = globalThis.KISARAGI_CATALOG_AUDIT;
const manifest = globalThis.KISARAGI_MISSING_IMAGE_MANIFEST;
const boundAssets = registry.filter((asset) => asset.file_path);

const walkImages = (directory) => {
  if (!directory || !existsSync(directory)) return [];
  return readdirSync(directory, {withFileTypes: true})
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return walkImages(path);
      return imageExtensions.has(extname(entry.name).toLowerCase()) ? [path] : [];
    });
};

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const pngDimensions = (bytes) => {
  if (bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
  return {format: 'png', width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20)};
};

const jpegDimensions = (bytes) => {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2 || offset + length + 2 > bytes.length) return null;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return {
        format: 'jpeg',
        width: bytes.readUInt16BE(offset + 7),
        height: bytes.readUInt16BE(offset + 5),
      };
    }
    offset += length + 2;
  }
  return null;
};

const webpDimensions = (bytes) => {
  if (bytes.length < 30 || bytes.subarray(0, 4).toString() !== 'RIFF' || bytes.subarray(8, 12).toString() !== 'WEBP') return null;
  const format = bytes.subarray(12, 16).toString();
  if (format === 'VP8X') {
    return {
      format: 'webp',
      width: 1 + bytes.readUIntLE(24, 3),
      height: 1 + bytes.readUIntLE(27, 3),
    };
  }
  if (format === 'VP8L' && bytes[20] === 0x2f) {
    return {
      format: 'webp',
      width: 1 + (bytes[21] | ((bytes[22] & 0x3f) << 8)),
      height: 1 + ((bytes[22] >> 6) | (bytes[23] << 2) | ((bytes[24] & 0x0f) << 10)),
    };
  }
  if (format === 'VP8 ' && bytes.subarray(23, 26).toString('hex') === '9d012a') {
    return {
      format: 'webp',
      width: bytes.readUInt16LE(26) & 0x3fff,
      height: bytes.readUInt16LE(28) & 0x3fff,
    };
  }
  return null;
};

const inspect = (path, displayPath = relative(root, path)) => {
  const bytes = readFileSync(path);
  const dimensions = pngDimensions(bytes) || jpegDimensions(bytes) || webpDimensions(bytes);
  return {
    file_path: displayPath,
    sha256: sha256(bytes),
    byte_size: statSync(path).size,
    format: dimensions?.format || 'unsupported',
    width: dimensions?.width || 0,
    height: dimensions?.height || 0,
    decodes: Boolean(dimensions?.width && dimensions?.height),
  };
};

const registeredFiles = boundAssets.map((asset) => {
  const path = resolve(root, asset.file_path);
  if (!existsSync(path)) {
    return {...asset, exists: false, decodes: false, width: 0, height: 0, sha256: null};
  }
  return {...asset, exists: true, ...inspect(path, asset.file_path)};
});
const registeredHashToAssets = new Map();
registeredFiles.forEach((file) => {
  if (!file.sha256) return;
  const assets = registeredHashToAssets.get(file.sha256) || [];
  assets.push(file.asset_id);
  registeredHashToAssets.set(file.sha256, assets);
});

const legacyDisposition = Object.freeze({
  'image3.png': ['DUPLICATE_OF_REGISTERED', 'Exact hash already registered as wt-1020-seven-stars.png.'],
  'image4.jpg': ['CONFLICT_REVIEW', 'Licensed Hope image, but no product-code or exact-variant evidence for wt-1016.'],
  'image8.jpg': ['OUT_OF_SCOPE', 'Marlboro is outside the 57-SKU Japan reference set.'],
  'image17.jpg': ['CONFLICT_REVIEW', 'One historical image contains two Seven Stars menthol variants.'],
});

const repoImageFiles = walkImages(resolve(root, 'assets/catalog'));
const registeredPaths = new Set(boundAssets.map((asset) => resolve(root, asset.file_path)));
const repoUnbound = repoImageFiles
  .filter((path) => !registeredPaths.has(path))
  .map((path) => {
    const details = inspect(path);
    const duplicateAssets = registeredHashToAssets.get(details.sha256) || [];
    const [review_status, reason] = legacyDisposition[basename(path)] || [
      duplicateAssets.length ? 'DUPLICATE_OF_REGISTERED' : 'UNBOUND_REVIEW_REQUIRED',
      duplicateAssets.length ? `Exact hash already registered by ${duplicateAssets.join(', ')}.` : 'No fail-closed SKU match is recorded.',
    ];
    return {...details, review_status, reason};
  });

const uploadDispositionByHash = Object.freeze({
  'a796db601c6ca58493191d621682228586cdf86426a0437c6f18174327542c15': ['USER_REJECTED_IMAGE', 'Previously rejected Mevius pair photo.'],
  'a050d9fbf4f5a979a9a7892e4c8eacb229a6a1b363f2a4d71507ddcd5192da5d': ['USER_REJECTED_IMAGE', 'Previously rejected Peace wood photo/screenshot.'],
  '8e0f270ef54106403f16df68ae0212c35dea7943ea06bc7417d2ce75639ea4e4': ['SCREENSHOT_EXCLUDED', 'Website screenshot is not a standalone SKU asset.'],
  'dd5838e30e578d60182b468d8c1948e19ecaf69186b5cd5698518c8598ce555b': ['SCREENSHOT_EXCLUDED', 'Website screenshot is not a standalone SKU asset.'],
  'c36b706b2cd9f25e0ae5bf1c543611a3f0eadd9afbca0b8f7082444c50bab4c7': ['SCREENSHOT_EXCLUDED', 'Website screenshot is not a standalone SKU asset.'],
  '1c52745f3beec3e35059057a50de14f8a8d2620438d7023443b33899f5640afd': ['NON_PRODUCT_EXCLUDED', 'Computer-screen photo is not a tobacco product asset.'],
  'cc7ff82b62216a220579616b5dd5eb3da6b008d4b94555971e3e4c0c736c4ad7': ['NON_PRODUCT_EXCLUDED', 'Computer-screen photo is not a tobacco product asset.'],
});

const uploadFiles = walkImages(uploadRoot).map((path) => {
  const details = inspect(path, `user-upload/${relative(uploadRoot, path)}`);
  const duplicateAssets = registeredHashToAssets.get(details.sha256) || [];
  const [review_status, reason] = uploadDispositionByHash[details.sha256] || [
    duplicateAssets.length ? 'DUPLICATE_OF_REGISTERED' : 'UNBOUND_REVIEW_REQUIRED',
    duplicateAssets.length ? `Exact hash already registered by ${duplicateAssets.join(', ')}.` : 'No fail-closed SKU match is recorded.',
  ];
  return {...details, review_status, reason};
});

const duplicateRegisteredHashes = [...registeredHashToAssets.entries()]
  .filter(([, assetIds]) => assetIds.length > 1)
  .map(([hash, assetIds]) => ({sha256: hash, asset_ids: assetIds}));
const unboundReport = {
  generated_from: ['KISARAGI_CANONICAL_CATALOG', 'KISARAGI_ASSET_REGISTRY'],
  catalog_asset_directory: 'assets/catalog/',
  upload_root_scanned: Boolean(uploadRoot && existsSync(uploadRoot)),
  counts: {
    registered_assets: registeredFiles.length,
    invalid_registered_assets: registeredFiles.filter((file) => !file.exists || !file.decodes || !file.width || !file.height).length,
    duplicate_registered_hashes: duplicateRegisteredHashes.length,
    repo_unbound_files: repoUnbound.length,
    upload_files_scanned: uploadFiles.length,
    upload_duplicates_of_registered: uploadFiles.filter((file) => file.review_status === 'DUPLICATE_OF_REGISTERED').length,
    upload_excluded_or_rejected: uploadFiles.filter((file) => file.review_status.endsWith('EXCLUDED') || file.review_status === 'USER_REJECTED_IMAGE').length,
    upload_review_required: uploadFiles.filter((file) => file.review_status === 'UNBOUND_REVIEW_REQUIRED').length,
  },
  registered_quality: registeredFiles,
  duplicate_registered_hashes: duplicateRegisteredHashes,
  repo_unbound_files: repoUnbound,
  upload_files: uploadFiles,
};

if (manifest.length !== audit.MISSING_IMAGE) {
  throw new Error(`Manifest count ${manifest.length} does not match runtime MISSING_IMAGE ${audit.MISSING_IMAGE}.`);
}
if (unboundReport.counts.invalid_registered_assets !== 0) {
  throw new Error(`${unboundReport.counts.invalid_registered_assets} registered assets failed existence or decode checks.`);
}
if (unboundReport.counts.duplicate_registered_hashes !== 0) {
  throw new Error(`${unboundReport.counts.duplicate_registered_hashes} duplicate hashes remain in the registered asset set.`);
}
if (shouldWrite) {
  const reportDirectory = resolve(root, 'reports');
  mkdirSync(reportDirectory, {recursive: true});
  writeFileSync(join(reportDirectory, 'MISSING_IMAGE_MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(reportDirectory, 'UNBOUND_ASSET_REPORT.json'), `${JSON.stringify(unboundReport, null, 2)}\n`);
}

console.log(JSON.stringify({
  TOTAL_REFERENCE_SKU: audit.TOTAL_REFERENCE_SKU,
  TOTAL_LOCAL_SKU: audit.TOTAL_LOCAL_SKU,
  TOTAL_ASSETS: audit.TOTAL_ASSETS,
  IMAGE_BOUND: audit.IMAGE_BOUND,
  MISSING_IMAGE: audit.MISSING_IMAGE,
  COMPLETE_SKU: audit.COMPLETE_SKU,
  CONFLICTS: audit.CONFLICTS,
  COVERAGE_PERCENT: audit.COVERAGE_PERCENT,
  MISSING_IMAGE_BY_BRAND: audit.MISSING_IMAGE_BY_BRAND,
  UNBOUND_ASSET_REPORT: unboundReport.counts,
}, null, 2));
