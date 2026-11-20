/**
 * SN Travels Agency — Image & Google Drive Link Helper
 * Uses fast Google CDN thumbnails by default for optimal performance,
 * with on-demand live refresh via `/api/proxy-image` when a Drive photo is replaced.
 */

export function extractGoogleDriveFileId(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // 1. /file/d/FILE_ID
  const driveFileRegex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i;
  const fileMatch = trimmed.match(driveFileRegex);
  if (fileMatch && fileMatch[1]) return fileMatch[1];

  // 2. id=FILE_ID
  const driveIdRegex = /drive\.google\.com\/(?:open|uc|thumbnail)\?(?:[a-zA-Z0-9_=&-]*)*id=([a-zA-Z0-9_-]+)/i;
  const idMatch = trimmed.match(driveIdRegex);
  if (idMatch && idMatch[1]) return idMatch[1];

  // 3. lh3.googleusercontent.com/d/FILE_ID
  const lh3Regex = /lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/i;
  const lh3Match = trimmed.match(lh3Regex);
  if (lh3Match && lh3Match[1]) return lh3Match[1];

  return null;
}

const DRIVE_REFRESH_STORAGE_KEY = 'sn_drive_photo_versions_v1';
const DRIVE_REFRESH_EVENT = 'sn-drive-photo-refreshed';
const DRIVE_REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (by then Google CDN thumbnails catch up)

function readRefreshMap(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(DRIVE_REFRESH_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    if (!parsed || typeof parsed !== 'object') return {};
    const now = Date.now();
    const cleaned: Record<string, number> = {};
    let mutated = false;
    for (const [key, ts] of Object.entries(parsed)) {
      if (typeof ts === 'number' && now - ts < DRIVE_REFRESH_TTL_MS) {
        cleaned[key] = ts;
      } else {
        mutated = true;
      }
    }
    if (mutated) {
      window.localStorage.setItem(DRIVE_REFRESH_STORAGE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return {};
  }
}

export function getDrivePhotoRefreshVersion(url: string | null | undefined): number | null {
  const fileId = extractGoogleDriveFileId(url);
  if (!fileId) return null;
  const map = readRefreshMap();
  return map[fileId] ?? null;
}

export function markDrivePhotoRefreshed(url: string | null | undefined): number | null {
  const fileId = extractGoogleDriveFileId(url);
  if (!fileId || typeof window === 'undefined') return null;
  const version = Date.now();
  try {
    const map = readRefreshMap();
    map[fileId] = version;
    window.localStorage.setItem(DRIVE_REFRESH_STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(
      new CustomEvent(DRIVE_REFRESH_EVENT, { detail: { fileId, version } })
    );
  } catch {
    // Ignore storage quota errors
  }
  return version;
}

export function subscribeDrivePhotoRefresh(
  handler: (detail: { fileId: string; version: number }) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (event: Event) => {
    const custom = event as CustomEvent<{ fileId: string; version: number }>;
    if (custom.detail?.fileId && custom.detail?.version) {
      handler(custom.detail);
    }
  };
  window.addEventListener(DRIVE_REFRESH_EVENT, listener);
  return () => window.removeEventListener(DRIVE_REFRESH_EVENT, listener);
}

export interface ImageCandidateOptions {
  cacheBuster?: string | number;
  forceRefresh?: boolean;
  /** 'thumb' uses compact w320 thumbnails for tables/lists; 'large' uses w1000 for previews */
  variant?: 'thumb' | 'large';
}

export function getGoogleDriveCandidateUrls(
  url: string | null | undefined,
  options?: ImageCandidateOptions
): string[] {
  if (!url || typeof url !== 'string') return [];
  const trimmed = url.trim();
  if (!trimmed) return [];

  // Data URL (e.g. uploaded file base64)
  if (trimmed.startsWith('data:image/')) {
    return [trimmed];
  }

  const width = options?.variant === 'thumb' ? 320 : 1000;
  const fileId = extractGoogleDriveFileId(trimmed);

  if (fileId) {
    const storedVersion = getDrivePhotoRefreshVersion(trimmed);
    const activeVersion = options?.cacheBuster ?? storedVersion;

    // On-demand live refresh path: only used for photos the user explicitly refreshed
    if (options?.forceRefresh || activeVersion) {
      const versionParam = activeVersion ? `&v=${activeVersion}` : '';
      const modeParam = options?.forceRefresh ? '&refresh=1' : '&live=1';
      return [
        `/api/proxy-image?url=${encodeURIComponent(trimmed)}${versionParam}${modeParam}`,
        `https://drive.usercontent.google.com/download?id=${fileId}&export=view${versionParam}`,
        `https://lh3.googleusercontent.com/d/${fileId}=w${width}`,
        `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`,
      ];
    }

    // Default fast path: direct resized thumbnails from Google CDN with full browser caching
    return [
      `https://lh3.googleusercontent.com/d/${fileId}=w${width}`,
      `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`,
      `/api/proxy-image?url=${encodeURIComponent(trimmed)}`,
    ];
  }

  // Already proxied
  if (trimmed.startsWith('/api/proxy-image')) {
    if (options?.forceRefresh && options?.cacheBuster) {
      const sep = trimmed.includes('?') ? '&' : '?';
      return [`${trimmed}${sep}v=${options.cacheBuster}&refresh=1`];
    }
    return [trimmed];
  }

  // Direct Web Image (e.g. Unsplash, CDN, or uploaded image URL)
  if (/^https?:\/\//i.test(trimmed)) {
    return [
      trimmed,
      `/api/proxy-image?url=${encodeURIComponent(trimmed)}`,
    ];
  }

  return [trimmed];
}

export function getGoogleDriveDirectImageUrl(url: string | null | undefined): string | null {
  const candidates = getGoogleDriveCandidateUrls(url);
  return candidates.length > 0 ? candidates[0] : null;
}

export function isGoogleDriveLink(url: string | null | undefined): boolean {
  if (!url) return false;
  return /drive\.google\.com|googleusercontent\.com/i.test(url);
}
