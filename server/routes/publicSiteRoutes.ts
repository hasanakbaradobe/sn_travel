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

  const configuredToken = (process.env.PUBLIC_SITE_EXPORT_TOKEN || '').trim();
  if (!configuredToken || configuredToken.length < 12) {
    return res.status(503).json({
      error: 'Publication export endpoint is not yet configured on the server. Set PUBLIC_SITE_EXPORT_TOKEN (minimum 12 characters) in your Render environment variables.',
    });
  }

  let candidateToken = '';
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    candidateToken = authHeader.substring(7).trim();
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
