/**
 * Public Hotel Website CMS — Express Routers
 * 1. publicSiteExportRouter: Server-to-Server Protected Publication Export Endpoint (for Netlify build)
 * 2. publicSiteAdminRouter: Authenticated Admin CMS Endpoints (Super Admin & Admin only)
 */

import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { publicSiteDb } from '../database/publicSiteDb.ts';

export const publicSiteExportRouter = Router();
export const publicSiteAdminRouter = Router();

/**
 * Constant-time token verification for server-to-server export requests.
 * Never logs secrets or authorization headers.
 */
function verifyExportToken(providedToken: string, expectedToken: string): boolean {
  if (!providedToken || !expectedToken) return false;
  const cleanProvided = providedToken.trim();
  const cleanExpected = expectedToken.trim();
  if (cleanProvided.length === 0 || cleanExpected.length < 12) return false;

  const bufA = Buffer.from(cleanProvided, 'utf-8');
  const bufB = Buffer.from(cleanExpected, 'utf-8');
  if (bufA.length !== bufB.length) {
    // Perform dummy comparison to keep timing uniform before returning false
    crypto.timingSafeEqual(bufB, bufB);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// --------------------------------------------------------------------------
// 1. Protected Publication Export Endpoint (Server-to-Server for Netlify Build)
// Route: GET /api/public-site/export
// --------------------------------------------------------------------------
publicSiteExportRouter.get('/export', async (req: Request, res: Response) => {
  await publicSiteDb.ensureInitialized();

  const configuredToken = (
    process.env.PUBLIC_SITE_EXPORT_TOKEN ||
    process.env.CRM_PUBLIC_EXPORT_TOKEN ||
    ''
  ).trim();
  if (!configuredToken || configuredToken.length < 12) {
    return res.status(503).json({
      error: 'Publication export endpoint is not yet configured on the server. Set PUBLIC_SITE_EXPORT_TOKEN (minimum 12 characters) in your Render environment variables.',
    });
  }

  let candidateToken = '';
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    candidateToken = authHeader.substring(7).trim();
  } else if (typeof req.headers['x-public-export-token'] === 'string') {
    candidateToken = req.headers['x-public-export-token'].trim();
  } else if (typeof req.headers['x-public-site-export-token'] === 'string') {
    candidateToken = req.headers['x-public-site-export-token'].trim();
  }

  if (!verifyExportToken(candidateToken, configuredToken)) {
    return res.status(401).json({
      error: 'Unauthorized: Valid server-to-server PUBLIC_SITE_EXPORT_TOKEN is required to export published website content.',
    });
  }

  const { snapshot, meta } = publicSiteDb.getLatestPublishedSnapshot();
  if (!snapshot || !meta) {
    return res.status(404).json({
      error: 'No published website snapshot exists yet. Please publish the website from the private CRM Public Website Management dashboard first.',
    });
  }

  return res.json({
    status: 'ok',
    exported_at: new Date().toISOString(),
    meta: {
      version_number: meta.version_number,
      snapshot_hash: meta.snapshot_hash,
      published_at: meta.created_at,
    },
    snapshot,
  });
});

// --------------------------------------------------------------------------
// 2. Authenticated Admin Middleware (Restricts CMS to Admin / Super Admin)
// --------------------------------------------------------------------------
function requireCmsAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  if (user.role !== 'super_admin' && user.role !== 'admin') {
    return res.status(403).json({
      error: 'Access denied: Only Administrator and Super Admin accounts are authorized to manage or publish the public website.',
    });
  }
  next();
}

publicSiteAdminRouter.use(requireCmsAdmin);

// Get full CMS bootstrap state
publicSiteAdminRouter.get('/bootstrap', async (_req: Request, res: Response) => {
  await publicSiteDb.ensureInitialized();
  return res.json(publicSiteDb.getBootstrapData());
});

// Get live draft preview snapshot (uses exact same structure as published snapshot)
publicSiteAdminRouter.get('/preview-snapshot', async (_req: Request, res: Response) => {
  await publicSiteDb.ensureInitialized();
  const snapshot = publicSiteDb.getDraftPreviewSnapshot();
  return res.json({ snapshot });
});

// Update General, Homepage, Navigation & SEO settings
publicSiteAdminRouter.put('/settings', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const updated = await publicSiteDb.updateSettings(req.body, user.id);
    return res.json(updated);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to save website settings' });
  }
});

// Resolve any Google Shareable Link (Google Drive file, Google Photos share link, Google Drive folder, or Google Images link)
// and pull the direct embeddable picture URL(s)
publicSiteAdminRouter.post('/resolve-google-link', async (req: Request, res: Response) => {
  try {
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    if (!rawUrl) {
      return res.status(400).json({ error: 'Please provide a shareable link or image URL.' });
    }

    // 1. Check if it is a Google Drive File Shareable Link
    const driveFileMatch = rawUrl.match(/(?:drive|docs)\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
    const driveIdMatch = rawUrl.match(
      /(?:drive|docs|drive\.usercontent)\.google\.com\/(?:open|uc|thumbnail|download)\?(?:[^#]*&)?id=([a-zA-Z0-9_-]+)/i
    );
    const lh3Match = rawUrl.match(/lh3\.googleusercontent\.com\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/i);
    const fileId =
      (driveFileMatch && driveFileMatch[1]) ||
      (driveIdMatch && driveIdMatch[1]) ||
      (lh3Match && lh3Match[1]);

    if (fileId) {
      const resolvedUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(resolvedUrl)}&fallback=404`;

      // Verify accessibility of the shared Google Drive picture
      let accessible = false;
      const testUrls = [
        `https://lh3.googleusercontent.com/d/${fileId}=w1200`,
        `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
        `https://drive.google.com/uc?export=download&id=${fileId}`,
      ];
      for (const testUrl of testUrls) {
        try {
          const checkResp = await fetch(testUrl, {
            method: 'GET',
            signal: AbortSignal.timeout(6000),
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          });
          const ct = checkResp.headers.get('content-type') || '';
          if (checkResp.ok && (ct.includes('image') || ct.includes('octet-stream'))) {
            accessible = true;
            break;
          }
        } catch {}
      }

      return res.json({
        original_url: rawUrl,
        resolved_url: resolvedUrl,
        proxy_url: proxyUrl,
        file_id: fileId,
        source_type: 'google_drive',
        accessible,
        gallery_urls: [resolvedUrl],
        message: accessible
          ? 'Picture pulled from Google Drive share link.'
          : 'Google Drive link converted, but the file appears private. Set Google Drive sharing to "Anyone with the link" so visitors can view the picture.',
      });
    }

    // 2. Check if it is a Google Drive Folder Shareable Link
    const folderMatch = rawUrl.match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]+)/i);
    if (folderMatch && folderMatch[1]) {
      const folderId = folderMatch[1];
      const extractedIds = new Set<string>();
      try {
        const folderResp = await fetch(`https://drive.google.com/embeddedfolderview?id=${folderId}#grid`, {
          signal: AbortSignal.timeout(7000),
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });
        if (folderResp.ok) {
          const html = await folderResp.text();
          const entryRegex = /id=["']entry-([a-zA-Z0-9_-]+)["']/gi;
          let m: RegExpExecArray | null;
          while ((m = entryRegex.exec(html)) !== null) {
            if (m[1] && m[1] !== folderId) extractedIds.add(m[1]);
          }
          const fileUrlRegex = /\/file\/d\/([a-zA-Z0-9_-]+)/gi;
          while ((m = fileUrlRegex.exec(html)) !== null) {
            if (m[1] && m[1] !== folderId) extractedIds.add(m[1]);
          }
        }
      } catch {}

      const galleryUrls = Array.from(extractedIds).map(
        (id) => `https://lh3.googleusercontent.com/d/${id}`
      );
      if (galleryUrls.length > 0) {
        return res.json({
          original_url: rawUrl,
          resolved_url: galleryUrls[0],
          proxy_url: `/api/proxy-image?url=${encodeURIComponent(galleryUrls[0])}&fallback=404`,
          file_id: folderId,
          source_type: 'google_drive_folder',
          accessible: true,
          gallery_urls: galleryUrls,
          message: `Pulled ${galleryUrls.length} picture${galleryUrls.length === 1 ? '' : 's'} from Google Drive shared folder.`,
        });
      }
      return res.status(400).json({
        error:
          'Could not find public images inside that Google Drive folder. Make sure the folder is shared with "Anyone with the link", or paste the individual image share link.',
      });
    }

    // 3. Check if it is a Google Photos or Google Images Shareable Link
    if (/photos\.app\.goo\.gl|photos\.google\.com\/share|images\.app\.goo\.gl|goo\.gl\/images/i.test(rawUrl)) {
      try {
        const pageResp = await fetch(rawUrl, {
          signal: AbortSignal.timeout(7000),
          redirect: 'follow',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });
        if (pageResp.ok) {
          const html = await pageResp.text();
          const ogMatch =
            html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
            html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
          if (ogMatch && ogMatch[1]) {
            const rawOg = ogMatch[1].replace(/&amp;/g, '&');
            const resolvedUrl = rawOg.replace(/=w\d+-h\d+[^"'\s]*/i, '=w1600');
            return res.json({
              original_url: rawUrl,
              resolved_url: resolvedUrl,
              proxy_url: `/api/proxy-image?url=${encodeURIComponent(resolvedUrl)}&fallback=404`,
              file_id: null,
              source_type: 'google_photos',
              accessible: true,
              gallery_urls: [resolvedUrl],
              message: 'Picture pulled from Google Photos share link.',
            });
          }
        }
      } catch {}
    }

    // 4. Check if it is a Google Images result URL (google.com/imgres?imgurl=...)
    if (/google\.com\/imgres\?/i.test(rawUrl)) {
      try {
        const parsed = new URL(rawUrl);
        const imgurl = parsed.searchParams.get('imgurl');
        if (imgurl && /^https?:\/\//i.test(imgurl)) {
          return res.json({
            original_url: rawUrl,
            resolved_url: imgurl.trim(),
            proxy_url: `/api/proxy-image?url=${encodeURIComponent(imgurl.trim())}&fallback=404`,
            file_id: null,
            source_type: 'google_images',
            accessible: true,
            gallery_urls: [imgurl.trim()],
            message: 'Picture pulled from Google Images share link.',
          });
        }
      } catch {}
    }

    // 5. Standard direct image URL or Dropbox link
    const cleanUrl = rawUrl.includes('dropbox.com') && rawUrl.includes('dl=0')
      ? rawUrl.replace('dl=0', 'raw=1')
      : rawUrl;

    return res.json({
      original_url: rawUrl,
      resolved_url: cleanUrl,
      proxy_url: `/api/proxy-image?url=${encodeURIComponent(cleanUrl)}&fallback=404`,
      file_id: null,
      source_type: 'direct_url',
      accessible: true,
      gallery_urls: [cleanUrl],
      message: 'Image URL connected.',
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to resolve Google shareable link' });
  }
});

// Update structured website page
publicSiteAdminRouter.put('/pages/:slug', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const updated = await publicSiteDb.updatePage(req.params.slug, req.body, user.id);
    if (!updated) {
      return res.status(404).json({ error: 'Page not found' });
    }
    return res.json(updated);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to update page' });
  }
});

// Hotels CRUD, Reorder & Sync from CRM
publicSiteAdminRouter.post('/hotels/sync-from-crm', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const result = await publicSiteDb.syncFromCrmHotels(user.id);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to sync hotels from CRM' });
  }
});

publicSiteAdminRouter.post('/hotels', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const hotel = await publicSiteDb.createHotel(req.body, user.id);
    return res.status(201).json(hotel);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to create hotel' });
  }
});

publicSiteAdminRouter.put('/hotels-reorder', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: 'orderedIds array is required' });
    }
    const hotels = await publicSiteDb.reorderHotels(orderedIds, user.id);
    return res.json(hotels);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to reorder hotels' });
  }
});

publicSiteAdminRouter.put('/hotels/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const id = parseInt(req.params.id, 10);
    const updated = await publicSiteDb.updateHotel(id, req.body, user.id);
    if (!updated) return res.status(404).json({ error: 'Hotel not found' });
    return res.json(updated);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to update hotel' });
  }
});

publicSiteAdminRouter.delete('/hotels/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const id = parseInt(req.params.id, 10);
    const ok = await publicSiteDb.deleteHotel(id, user.id);
    if (!ok) return res.status(404).json({ error: 'Hotel not found' });
    return res.json({ success: true, message: 'Hotel and its rooms deleted' });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to delete hotel' });
  }
});

// Rooms CRUD & Reorder
publicSiteAdminRouter.post('/rooms', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const room = await publicSiteDb.createRoom(req.body, user.id);
    return res.status(201).json(room);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to create room type' });
  }
});

publicSiteAdminRouter.put('/rooms-reorder', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: 'orderedIds array is required' });
    }
    const rooms = await publicSiteDb.reorderRooms(orderedIds, user.id);
    return res.json(rooms);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to reorder rooms' });
  }
});

publicSiteAdminRouter.put('/rooms/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const id = parseInt(req.params.id, 10);
    const updated = await publicSiteDb.updateRoom(id, req.body, user.id);
    if (!updated) return res.status(404).json({ error: 'Room not found' });
    return res.json(updated);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to update room' });
  }
});

publicSiteAdminRouter.delete('/rooms/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const id = parseInt(req.params.id, 10);
    const ok = await publicSiteDb.deleteRoom(id, user.id);
    if (!ok) return res.status(404).json({ error: 'Room not found' });
    return res.json({ success: true, message: 'Room deleted' });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to delete room' });
  }
});

// Facilities CRUD & Reorder
publicSiteAdminRouter.post('/facilities', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const facility = await publicSiteDb.createFacility(req.body, user.id);
    return res.status(201).json(facility);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to create facility' });
  }
});

publicSiteAdminRouter.put('/facilities-reorder', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: 'orderedIds array is required' });
    }
    const list = await publicSiteDb.reorderFacilities(orderedIds, user.id);
    return res.json(list);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to reorder facilities' });
  }
});

publicSiteAdminRouter.put('/facilities/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const id = parseInt(req.params.id, 10);
    const updated = await publicSiteDb.updateFacility(id, req.body, user.id);
    if (!updated) return res.status(404).json({ error: 'Facility not found' });
    return res.json(updated);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to update facility' });
  }
});

publicSiteAdminRouter.delete('/facilities/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const id = parseInt(req.params.id, 10);
    const ok = await publicSiteDb.deleteFacility(id, user.id);
    if (!ok) return res.status(404).json({ error: 'Facility not found' });
    return res.json({ success: true, message: 'Facility deleted' });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to delete facility' });
  }
});

// Gallery CRUD & Reorder
publicSiteAdminRouter.post('/gallery', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const item = await publicSiteDb.createGalleryItem(req.body, user.id);
    return res.status(201).json(item);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to add gallery image' });
  }
});

publicSiteAdminRouter.put('/gallery-reorder', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: 'orderedIds array is required' });
    }
    const list = await publicSiteDb.reorderGallery(orderedIds, user.id);
    return res.json(list);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to reorder gallery' });
  }
});

publicSiteAdminRouter.put('/gallery/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const id = parseInt(req.params.id, 10);
    const updated = await publicSiteDb.updateGalleryItem(id, req.body, user.id);
    if (!updated) return res.status(404).json({ error: 'Gallery image not found' });
    return res.json(updated);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to update gallery image' });
  }
});

publicSiteAdminRouter.delete('/gallery/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const id = parseInt(req.params.id, 10);
    const ok = await publicSiteDb.deleteGalleryItem(id, user.id);
    if (!ok) return res.status(404).json({ error: 'Gallery image not found' });
    return res.json({ success: true, message: 'Gallery image deleted' });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to delete gallery image' });
  }
});

// FAQ CRUD & Reorder
publicSiteAdminRouter.post('/faqs', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const faq = await publicSiteDb.createFaq(req.body, user.id);
    return res.status(201).json(faq);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to create FAQ' });
  }
});

publicSiteAdminRouter.put('/faqs-reorder', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: 'orderedIds array is required' });
    }
    const list = await publicSiteDb.reorderFaqs(orderedIds, user.id);
    return res.json(list);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to reorder FAQs' });
  }
});

publicSiteAdminRouter.put('/faqs/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const id = parseInt(req.params.id, 10);
    const updated = await publicSiteDb.updateFaq(id, req.body, user.id);
    if (!updated) return res.status(404).json({ error: 'FAQ not found' });
    return res.json(updated);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to update FAQ' });
  }
});

publicSiteAdminRouter.delete('/faqs/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const id = parseInt(req.params.id, 10);
    const ok = await publicSiteDb.deleteFaq(id, user.id);
    if (!ok) return res.status(404).json({ error: 'FAQ not found' });
    return res.json({ success: true, message: 'FAQ deleted' });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to delete FAQ' });
  }
});

// Publish Website (Step 3: Snapshot + Netlify Build Hook)
publicSiteAdminRouter.post('/publish', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { notes } = req.body || {};
    const result = await publicSiteDb.publishWebsite(
      { id: user.id, name: user.name || user.email || 'Administrator' },
      notes
    );
    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Publication failed' });
  }
});

// Verify Netlify Deployment Status (Step 5)
publicSiteAdminRouter.post('/verify-deployment/:id', async (req: Request, res: Response) => {
  try {
    const pubId = parseInt(req.params.id, 10);
    const result = await publicSiteDb.verifyNetlifyDeployment(pubId);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to check deployment status' });
  }
});
