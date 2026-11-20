/**
 * SN Travels Agency — Image & Google Drive Link Helper
 * Routes images through server-side proxy route `/api/proxy-image`
 * to guarantee Google Drive share links load reliably without CORS or referrer blocks.
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

const SESSION_IMAGE_VERSION = Date.now();

export function getGoogleDriveCandidateUrls(
  url: string | null | undefined,
  options?: { cacheBuster?: string | number; forceRefresh?: boolean }
): string[] {
  if (!url || typeof url !== 'string') return [];
  const trimmed = url.trim();
  if (!trimmed) return [];

  // Data URL (e.g. uploaded file base64)
  if (trimmed.startsWith('data:image/')) {
    return [trimmed];
  }

  const version = options?.cacheBuster ?? SESSION_IMAGE_VERSION;
  const refreshParam = options?.forceRefresh ? '&refresh=1' : '';

  // Google Drive Link — prefer server proxy (which fetches the live file via drive.usercontent.google.com
  // instead of Google's stale lh3/thumbnail CDN cache) so replaced Drive photos update reliably
  const fileId = extractGoogleDriveFileId(trimmed);
  if (fileId) {
    return [
      `/api/proxy-image?url=${encodeURIComponent(trimmed)}&v=${version}${refreshParam}`,
      `https://drive.usercontent.google.com/download?id=${fileId}&export=view&v=${version}`,
      `https://lh3.googleusercontent.com/d/${fileId}=w1000?v=${version}`,
      `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000&v=${version}`,
    ];
  }

  // Already proxied
  if (trimmed.startsWith('/api/proxy-image')) {
    const sep = trimmed.includes('?') ? '&' : '?';
    return [`${trimmed}${sep}v=${version}${refreshParam}`];
  }

  // Direct Web Image (e.g. Unsplash, CDN, or uploaded image URL)
  if (/^https?:\/\//i.test(trimmed)) {
    return [
      trimmed,
      `/api/proxy-image?url=${encodeURIComponent(trimmed)}&v=${version}${refreshParam}`,
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
