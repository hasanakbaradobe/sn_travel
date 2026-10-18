/**
 * Utility to process and convert Google Drive sharing links, Google Docs links,
 * and general web URLs into direct, embeddable image URLs that render reliably
 * in <img> tags, canvas, and print stylesheets.
 */

export function extractGoogleDriveId(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // 1. /file/d/FILE_ID
  const driveFileRegex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i;
  const matchDriveFile = trimmed.match(driveFileRegex);
  if (matchDriveFile && matchDriveFile[1]) {
    return matchDriveFile[1];
  }

  // 2. ?id=FILE_ID or &id=FILE_ID on drive.google.com / docs.google.com
  const driveIdParamRegex = /[?&]id=([a-zA-Z0-9_-]+)/i;
  if (trimmed.includes('drive.google.com') || trimmed.includes('docs.google.com')) {
    const matchId = trimmed.match(driveIdParamRegex);
    if (matchId && matchId[1]) {
      return matchId[1];
    }
  }

  // 3. lh3.googleusercontent.com/d/FILE_ID
  const lh3Regex = /lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/i;
  const matchLh3 = trimmed.match(lh3Regex);
  if (matchLh3 && matchLh3[1]) {
    return matchLh3[1];
  }

  return null;
}

export function formatGoogleImageUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  const fileId = extractGoogleDriveId(trimmed);
  if (fileId) {
    // Direct Google CDN stream (returns 200 image/png with Access-Control-Allow-Origin: *)
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  return trimmed;
}

export const DEFAULT_COMPANY_LOGO_URL = 'https://lh3.googleusercontent.com/d/1wJCY1RJCq0hASsYGGRnScbXDOW9YdPsM';

/**
 * Returns an ordered list of candidate image URLs for resilient fallback loading
 */
export function getInvoiceLogoCandidates(url?: string | null): string[] {
  const raw = (!url || typeof url !== 'string' || !url.trim() || url.includes('photo-1569154941061'))
    ? DEFAULT_COMPANY_LOGO_URL
    : url.trim();

  if (raw.startsWith('data:image/')) {
    return [raw];
  }

  const fileId = extractGoogleDriveId(raw);
  if (fileId) {
    return [
      `/api/proxy-image?url=${encodeURIComponent(raw)}&fallback=404`,
      `https://lh3.googleusercontent.com/d/${fileId}`,
      `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
      `https://drive.google.com/uc?export=view&id=${fileId}`,
    ];
  }

  if (raw.startsWith('/api/proxy-image')) {
    return [raw];
  }

  if (/^https?:\/\//i.test(raw)) {
    return [
      `/api/proxy-image?url=${encodeURIComponent(raw)}&fallback=404`,
      raw,
    ];
  }

  return [raw];
}

/**
 * Checks if a URL looks like a Google Drive link
 */
export function isGoogleDriveLink(url?: string | null): boolean {
  if (!url) return false;
  return url.includes('drive.google.com') || url.includes('docs.google.com') || url.includes('googleusercontent.com');
}
