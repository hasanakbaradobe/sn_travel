/**
 * SN Travels Agency — REST API Router
 * All business logic, authorization, input validation, and database operations
 */

import { Router, Request, Response, NextFunction } from 'express';
import { dbService } from '../database/db.ts';
import { scanPassportDocument } from '../services/passportScanner.ts';
import {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  checkLoginRateLimit,
  recordFailedLogin,
  resetLoginAttempts,
  validatePasswordStrength,
} from '../services/auth.ts';
import fs from 'fs';
import path from 'path';

export const apiRouter = Router();

// --------------------------------------------------------------------------
// Server-Sent Events (SSE) Real-Time Broadcast Infrastructure
// --------------------------------------------------------------------------
const sseClients = new Set<Response>();

export function broadcastDataChange(eventType: string = 'data_changed', data?: any) {
  const payload = `data: ${JSON.stringify({ type: eventType, timestamp: Date.now(), ...(data || {}) })}\n\n`;
  sseClients.forEach((clientRes) => {
    try {
      clientRes.write(payload);
    } catch {
      sseClients.delete(clientRes);
    }
  });
}

apiRouter.get('/events', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof (res as any).flushHeaders === 'function') {
    (res as any).flushHeaders();
  }

  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);
  sseClients.add(res);

  _req.on('close', () => {
    sseClients.delete(res);
  });
});

// Middleware: Disable client/proxy HTTP caching and perform smart non-blocking MySQL sync
apiRouter.use(async (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  try {
    await dbService.syncFromMySQL(false);
  } catch (err: any) {
    // Non-blocking sync error catch
  }
  next();
});

// Middleware: Auto-broadcast SSE event on successful write mutations (POST, PUT, PATCH, DELETE)
apiRouter.use((req: Request, res: Response, next: NextFunction) => {
  const method = req.method.toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const originalJson = res.json;
    res.json = function (body: any) {
      if (res.statusCode < 400 && req.path !== '/auth/login' && req.path !== '/auth/me') {
        broadcastDataChange('data_changed', { endpoint: req.path });
      }
      return originalJson.call(this, body);
    };
  }
  next();
});

// Health Check (Public)
apiRouter.get('/health', (_req: Request, res: Response) => {
  return res.json({ status: 'ok', timestamp: new Date().toISOString(), sse_clients: sseClients.size });
});

// --------------------------------------------------------------------------
// Authentication & Security Middleware
// --------------------------------------------------------------------------

/**
 * Extracts and cryptographically verifies the current authenticated user from Bearer token
 */
function getCurrentUser(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload || !payload.id) {
    return null;
  }

  const user = dbService.getUserById(payload.id);
  if (!user || user.is_active !== 1) {
    return null;
  }

  return user;
}

/**
 * Middleware: Requires a valid, active authenticated user session.
 * Rejects unauthenticated requests with 401 Unauthorized.
 */
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = getCurrentUser(req);
  if (!user) {
    return res.status(401).json({
      error: 'Authentication required. Your session may have expired. Please sign in.',
    });
  }
  (req as any).user = user;
  next();
}

/**
 * Middleware: Requires Super Admin privileges.
 */
function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user || getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  if (user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super Admin access required for this action.' });
  }
  (req as any).user = user;
  next();
}

// --------------------------------------------------------------------------
// Public Auth Endpoints
// --------------------------------------------------------------------------

// Check if secret login URL protection is enabled, and validate candidate key
apiRouter.get('/auth/secret-check', (req: Request, res: Response) => {
  const { key } = req.query;
  const config = dbService.getSecretLoginSettings();

  if (!config.enabled) {
    return res.json({ protected: false, valid: true });
  }

  const candidate = String(key || '').trim().toLowerCase();
  const isValid = candidate.length > 0 && candidate === config.secretKey.toLowerCase();

  return res.json({
    protected: true,
    valid: isValid,
    key: isValid ? config.secretKey : undefined,
  });
});

apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { email, password, secretKey } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Enforce Secret Login URL verification if enabled
  const secretSettings = dbService.getSecretLoginSettings();
  if (secretSettings.enabled) {
    const providedSecret =
      (secretKey as string) ||
      (req.headers['x-secret-key'] as string) ||
      (req.headers['x-login-secret'] as string) ||
      '';
    const cleanProvided = String(providedSecret).trim().toLowerCase();
    if (!cleanProvided || cleanProvided !== secretSettings.secretKey.toLowerCase()) {
      return res.status(403).json({
        error: 'Access denied: Valid secret login URL is required to sign in. Direct logins are blocked.',
      });
    }
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.ip || req.socket.remoteAddress || 'unknown';
  const rateLimitKey = `${clientIp}:${normalizedEmail}`;

  // Rate Limiting check
  const rateCheck = checkLoginRateLimit(rateLimitKey);
  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: `Too many failed login attempts. Account temporarily locked for security. Please try again in ${rateCheck.waitSeconds} seconds.`,
      waitSeconds: rateCheck.waitSeconds,
    });
  }

  const user = dbService.getUserByEmail(normalizedEmail);
  if (!user) {
    const rateInfo = recordFailedLogin(rateLimitKey);
    return res.status(401).json({
      error: 'Invalid email or password.',
      remainingAttempts: rateInfo.remainingAttempts,
    });
  }

  const isPasswordValid = verifyPassword(password, user.password_hash);
  if (!isPasswordValid) {
    const rateInfo = recordFailedLogin(rateLimitKey);
    return res.status(401).json({
      error: 'Invalid email or password.',
      remainingAttempts: rateInfo.remainingAttempts,
    });
  }

  if (!user.is_active) {
    return res.status(403).json({
      error: 'This account has been deactivated. Please contact Super Admin.',
    });
  }

  // Transparently upgrade legacy plain-text or SHA256 hashes to scrypt on successful login
  if (!user.password_hash.startsWith('scrypt:')) {
    user.password_hash = hashPassword(password);
  }

  // Reset failed login tracking on success
  resetLoginAttempts(rateLimitKey);

  // Update last login timestamp
  dbService.updateUserLastLogin(user.id);

  // Sign cryptographic token (HMAC-SHA256, 24-hour expiration)
  const token = signToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      last_login_at: user.last_login_at || new Date().toISOString(),
    },
  });
});

// --------------------------------------------------------------------------
// Protected Routes — All endpoints below require a valid authentication token
// --------------------------------------------------------------------------
apiRouter.use(requireAuth);

apiRouter.get('/auth/me', (req: Request, res: Response) => {
  const user = (req as any).user;
  return res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      last_login_at: user.last_login_at || null,
      created_at: user.created_at,
    },
  });
});

apiRouter.post('/auth/change-password', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  const isCurrentValid = verifyPassword(current_password, currentUser.password_hash);
  if (!isCurrentValid) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const strength = validatePasswordStrength(new_password);
  if (!strength.valid) {
    return res.status(400).json({ error: strength.reason });
  }

  const newHash = hashPassword(new_password);
  dbService.updateUser(currentUser.id, { password_hash: newHash }, currentUser.id);

  return res.json({ message: 'Password changed successfully' });
});

// --------------------------------------------------------------------------
// Passport Scanner Endpoint (High-Accuracy Multimodal + Fallback)
// --------------------------------------------------------------------------
apiRouter.post('/scan-passport', async (req: Request, res: Response) => {
  try {
    const { image, imageData, mimeType, engine } = req.body;
    const targetImage = image || imageData;
    if (!targetImage) {
      return res.status(400).json({ error: 'No image provided for passport scan' });
    }

    const result = await scanPassportDocument(targetImage, mimeType, engine || 'auto');
    return res.json(result);
  } catch (err: any) {
    console.error('[API /scan-passport] Error:', err);
    return res.status(500).json({
      error: err.message || 'Failed to scan passport image',
    });
  }
});

// --------------------------------------------------------------------------
// Client Endpoints
// --------------------------------------------------------------------------
apiRouter.get('/clients', (req: Request, res: Response) => {
  const { search, country, page, limit, sortBy, sortOrder } = req.query;

  if (page !== undefined || limit !== undefined) {
    const result = dbService.getClientsPaginated({
      search: typeof search === 'string' ? search : undefined,
      country: typeof country === 'string' ? country : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 25,
      sortBy: typeof sortBy === 'string' ? sortBy : undefined,
      sortOrder: sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : undefined,
    });
    return res.json(result);
  }

  const clients = dbService.getClients(
    typeof search === 'string' ? search : undefined,
    typeof country === 'string' ? country : undefined
  );
  return res.json(clients);
});

apiRouter.post('/clients/check-duplicate', (req: Request, res: Response) => {
  const { passport_number, full_name } = req.body;
  if (!passport_number) {
    return res.status(400).json({ error: 'Passport number is required for duplicate check' });
  }
  const result = dbService.checkDuplicate(passport_number, full_name);
  return res.json(result);
});

apiRouter.get('/clients/next-serial', (req: Request, res: Response) => {
  const result = dbService.getNextClientSerial();
  return res.json(result);
});

apiRouter.get('/clients/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const client = dbService.getClientById(id);
  if (!client) {
    return res.status(404).json({ error: 'Client not found' });
  }
  return res.json(client);
});

apiRouter.post('/clients', async (req: Request, res: Response) => {
  const currentUser = getCurrentUser(req);
  const { full_name, passport_number, country, ignore_duplicate, custom_fields, ...rest } = req.body;

  if (!full_name || !passport_number || !country) {
    return res.status(400).json({ error: 'Full Name, Passport Number, and Country are required' });
  }

  // Duplicate check unless explicitly acknowledged
  if (!ignore_duplicate) {
    const dupCheck = dbService.checkDuplicate(passport_number, full_name);
    if (dupCheck.has_duplicate) {
      return res.status(409).json({
        error: 'Possible existing client found with this passport number or name.',
        matches: dupCheck.matches,
      });
    }
  }

  const client = await dbService.createClient(
    {
      full_name,
      passport_number,
      country,
      custom_fields,
      ...rest,
    },
    currentUser?.id || 1
  );

  return res.status(201).json(client);
});

apiRouter.put('/clients/:id', async (req: Request, res: Response) => {
  const currentUser = getCurrentUser(req);
  const id = parseInt(req.params.id, 10);
  const updated = await dbService.updateClient(id, req.body, currentUser?.id || 1);
  if (!updated) {
    return res.status(404).json({ error: 'Client not found' });
  }
  return res.json(updated);
});

apiRouter.delete('/clients/:id', async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    const success = await dbService.deleteClient(id, currentUser?.id || 1);
    if (!success) {
      return res.status(404).json({ error: 'Client not found' });
    }
    return res.json({ message: 'Client deleted successfully' });
  } catch (err: any) {
    console.error('[API] Error deleting client:', err);
    return res.status(500).json({ error: 'Failed to delete client: ' + (err.message || 'Server error') });
  }
});

// --------------------------------------------------------------------------
// Visa Applications Endpoints
// --------------------------------------------------------------------------
apiRouter.get('/applications', (req: Request, res: Response) => {
  const { status, visa_type_id, staff_id, search, page, limit } = req.query;

  if (page !== undefined || limit !== undefined) {
    const result = dbService.getApplicationsPaginated({
      status: typeof status === 'string' ? status : undefined,
      visa_type_id: visa_type_id ? Number(visa_type_id) : undefined,
      staff_id: staff_id ? Number(staff_id) : undefined,
      search: typeof search === 'string' ? search : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 25,
    });
    return res.json(result);
  }

  const list = dbService.getApplications({
    status: typeof status === 'string' ? status : undefined,
    visa_type_id: visa_type_id ? Number(visa_type_id) : undefined,
    staff_id: staff_id ? Number(staff_id) : undefined,
    search: typeof search === 'string' ? search : undefined,
  });
  return res.json(list);
});

apiRouter.get('/applications/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const app = dbService.getApplicationById(id);
  if (!app) {
    return res.status(404).json({ error: 'Application not found' });
  }
  return res.json(app);
});

apiRouter.post('/applications', async (req: Request, res: Response) => {
  const currentUser = getCurrentUser(req);
  const { client_id, visa_type_id, status, delivery_date, notes, assigned_user_id } = req.body;

  if (!client_id || !visa_type_id) {
    return res.status(400).json({ error: 'Client and Visa Type are required' });
  }

  const app = await dbService.createApplication(
    {
      client_id: Number(client_id),
      visa_type_id: Number(visa_type_id),
      status,
      delivery_date,
      notes,
      assigned_user_id: assigned_user_id ? Number(assigned_user_id) : undefined,
    },
    currentUser?.id || 1
  );

  return res.status(201).json(app);
});

apiRouter.patch('/applications/:id/status', async (req: Request, res: Response) => {
  const currentUser = getCurrentUser(req);
  const id = parseInt(req.params.id, 10);
  const { status, delivery_date, notes } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  const updated = await dbService.updateApplicationStatus(
    id,
    status,
    delivery_date,
    notes,
    currentUser?.id || 1
  );

  if (!updated) {
    return res.status(404).json({ error: 'Application not found' });
  }

  return res.json(updated);
});

apiRouter.put('/applications/:id', async (req: Request, res: Response) => {
  const currentUser = getCurrentUser(req);
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid application ID' });
  }
  const updated = await dbService.updateApplication(id, req.body, currentUser?.id || 1);
  if (!updated) {
    return res.status(404).json({ error: 'Application not found' });
  }
  return res.json(updated);
});

apiRouter.delete('/applications/:id', async (req: Request, res: Response) => {
  const currentUser = getCurrentUser(req);
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid application ID' });
  }
  const ok = await dbService.deleteApplication(id, currentUser?.id || 1);
  if (!ok) {
    return res.status(404).json({ error: 'Application not found' });
  }
  return res.json({ success: true, message: 'Application deleted successfully' });
});

// --------------------------------------------------------------------------
// Tasks Endpoints
// --------------------------------------------------------------------------
apiRouter.get('/tasks', (req: Request, res: Response) => {
  const { status, priority, user_id, client_id, due_date } = req.query;
  const list = dbService.getTasks({
    status: typeof status === 'string' ? status : undefined,
    priority: typeof priority === 'string' ? priority : undefined,
    user_id: user_id ? Number(user_id) : undefined,
    client_id: client_id ? Number(client_id) : undefined,
    due_date: typeof due_date === 'string' ? due_date : undefined,
  });
  return res.json(list);
});

apiRouter.post('/tasks', async (req: Request, res: Response) => {
  const currentUser = getCurrentUser(req);
  const { title, description, client_id, application_id, assigned_user_id, due_date, priority } = req.body;

  if (!title || !due_date) {
    return res.status(400).json({ error: 'Task Title and Due Date are required' });
  }

  const task = await dbService.createTask(
    {
      title,
      description,
      client_id: client_id ? Number(client_id) : null,
      application_id: application_id ? Number(application_id) : null,
      assigned_user_id: assigned_user_id ? Number(assigned_user_id) : (currentUser?.id || 1),
      due_date,
      priority,
    },
    currentUser?.id || 1
  );

  return res.status(201).json(task);
});

apiRouter.put('/tasks/:id', async (req: Request, res: Response) => {
  const currentUser = getCurrentUser(req);
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid task ID' });
  }
  const updated = await dbService.updateTask(id, req.body, currentUser?.id || 1);
  if (!updated) {
    return res.status(404).json({ error: 'Task not found' });
  }
  return res.json(updated);
});

apiRouter.patch('/tasks/:id/toggle', async (req: Request, res: Response) => {
  const currentUser = getCurrentUser(req);
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid task ID' });
  }
  const currentTask = dbService.getTaskById(id);
  if (!currentTask) {
    return res.status(404).json({ error: 'Task not found' });
  }
  const nextStatus = currentTask.status === 'Completed' ? 'Pending' : 'Completed';
  const updated = await dbService.updateTask(id, { status: nextStatus }, currentUser?.id || 1);
  return res.json(updated);
});

apiRouter.delete('/tasks/:id', async (req: Request, res: Response) => {
  const currentUser = getCurrentUser(req);
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid task ID' });
  }
  await dbService.deleteTask(id, currentUser?.id || 1);
  return res.json({ message: 'Task deleted successfully' });
});

// --------------------------------------------------------------------------
// Calendar Endpoint
// --------------------------------------------------------------------------
apiRouter.get('/calendar', (req: Request, res: Response) => {
  const tasks = dbService.getTasks();
  return res.json(tasks);
});

// --------------------------------------------------------------------------
// Comments Endpoints
// --------------------------------------------------------------------------
apiRouter.get('/comments', (req: Request, res: Response) => {
  const { client_id, application_id } = req.query;
  if (!client_id) {
    return res.status(400).json({ error: 'client_id is required' });
  }
  const comments = dbService.getComments(
    Number(client_id),
    application_id ? Number(application_id) : undefined
  );
  return res.json(comments);
});

apiRouter.post('/comments', async (req: Request, res: Response) => {
  const currentUser = getCurrentUser(req);
  const { client_id, application_id, message } = req.body;

  if (!client_id || !message) {
    return res.status(400).json({ error: 'client_id and message are required' });
  }

  const comment = await dbService.createComment({
    client_id: Number(client_id),
    application_id: application_id ? Number(application_id) : null,
    user_id: currentUser?.id || 1,
    message,
  });

  return res.status(201).json(comment);
});

// --------------------------------------------------------------------------
// Custom Fields Endpoints (Super Admin)
// --------------------------------------------------------------------------
apiRouter.get('/custom-fields', (req: Request, res: Response) => {
  const { active_only } = req.query;
  const fields = dbService.getCustomFields(active_only === 'true');
  return res.json(fields);
});

apiRouter.post('/custom-fields', async (req: Request, res: Response) => {
  const currentUser = getCurrentUser(req);
  if (currentUser?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super Admin access required to manage custom fields' });
  }

  const { field_name, field_label, field_type, field_options, is_required, display_order } = req.body;
  if (!field_name || !field_label || !field_type) {
    return res.status(400).json({ error: 'Field name, label, and type are required' });
  }

  const field = await dbService.createCustomField(
    { field_name, field_label, field_type, field_options, is_required, display_order },
    currentUser.id
  );
  return res.status(201).json(field);
});

apiRouter.put('/custom-fields/:id', async (req: Request, res: Response) => {
  const currentUser = getCurrentUser(req);
  if (currentUser?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super Admin access required to manage custom fields' });
  }

  const id = parseInt(req.params.id, 10);
  const updated = await dbService.updateCustomField(id, req.body, currentUser.id);
  if (!updated) {
    return res.status(404).json({ error: 'Field not found' });
  }
  return res.json(updated);
});

apiRouter.delete('/custom-fields/:id', async (req: Request, res: Response) => {
  const currentUser = getCurrentUser(req);
  if (currentUser?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super Admin access required to delete custom fields' });
  }

  const id = parseInt(req.params.id, 10);
  const success = await dbService.deleteCustomField(id, currentUser.id);
  if (!success) {
    return res.status(404).json({ error: 'Field not found' });
  }
  return res.json({ message: 'Field deleted successfully' });
});

// --------------------------------------------------------------------------
// Visa Types Endpoints (Super Admin)
// --------------------------------------------------------------------------
apiRouter.get('/visa-types', (req: Request, res: Response) => {
  const { active_only } = req.query;
  const list = dbService.getVisaTypes(active_only === 'true');
  return res.json(list);
});

apiRouter.post('/visa-types', async (req: Request, res: Response) => {
  const currentUser = getCurrentUser(req);
  if (currentUser?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super Admin access required to manage visa types' });
  }

  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Visa type name is required' });
  }

  const vt = await dbService.createVisaType({ name, description }, currentUser.id);
  return res.status(201).json(vt);
});

apiRouter.put('/visa-types/:id', async (req: Request, res: Response) => {
  const currentUser = getCurrentUser(req);
  if (currentUser?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super Admin access required' });
  }

  const id = parseInt(req.params.id, 10);
  const updated = await dbService.updateVisaType(id, req.body, currentUser.id);
  if (!updated) {
    return res.status(404).json({ error: 'Visa type not found' });
  }
  return res.json(updated);
});

apiRouter.delete('/visa-types/:id', async (req: Request, res: Response) => {
  const currentUser = getCurrentUser(req);
  if (currentUser?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super Admin access required' });
  }

  const id = parseInt(req.params.id, 10);
  try {
    const success = await dbService.deleteVisaType(id, currentUser.id);
    if (!success) {
      return res.status(404).json({ error: 'Visa type not found' });
    }
    return res.json({ message: 'Visa type deleted' });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Cannot delete visa type' });
  }
});

// --------------------------------------------------------------------------
// Countries Endpoints
// --------------------------------------------------------------------------
apiRouter.get('/countries', (req: Request, res: Response) => {
  const { active_only } = req.query;
  const list = dbService.getCountries(active_only === 'true');
  return res.json(list);
});

apiRouter.post('/countries', async (req: Request, res: Response) => {
  const currentUser = getCurrentUser(req);
  const { name, code } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Country name is required' });
  }

  const country = await dbService.createCountry({ name: name.trim(), code }, currentUser?.id || 1);
  return res.status(201).json(country);
});

apiRouter.put('/countries/:id', async (req: Request, res: Response) => {
  const currentUser = getCurrentUser(req);
  const id = parseInt(req.params.id, 10);
  const updated = await dbService.updateCountry(id, req.body, currentUser?.id || 1);
  if (!updated) {
    return res.status(404).json({ error: 'Country not found' });
  }
  return res.json(updated);
});

apiRouter.delete('/countries/:id', async (req: Request, res: Response) => {
  const currentUser = getCurrentUser(req);
  const id = parseInt(req.params.id, 10);
  const success = await dbService.deleteCountry(id, currentUser?.id || 1);
  if (!success) {
    return res.status(404).json({ error: 'Country not found' });
  }
  return res.json({ message: 'Country deleted' });
});

// --------------------------------------------------------------------------
// User Management Endpoints (Super Admin)
// --------------------------------------------------------------------------
apiRouter.get('/users', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const users = dbService.getUsers();

  // If super admin, return full user management data
  if (currentUser?.role === 'super_admin') {
    return res.json(users);
  }

  // Non-super-admin staff can only see active staff members for assignment purposes
  const directory = users
    .filter(u => u.is_active === 1)
    .map(u => ({
      id: u.id,
      name: u.name,
      role: u.role,
    }));
  return res.json(directory);
});

apiRouter.post('/users', requireSuperAdmin, async (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password, and role are required' });
  }

  const validRoles = ['super_admin', 'admin', 'staff'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid user role specified' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = dbService.getUserByEmail(normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: 'A user account with this email address already exists' });
  }

  // Password validation
  const strength = validatePasswordStrength(password);
  if (!strength.valid) {
    return res.status(400).json({ error: strength.reason });
  }

  const user = await dbService.createUser({
    name: name.trim(),
    email: normalizedEmail,
    password_hash: hashPassword(password),
    role,
    is_active: 1,
  }, currentUser.id);

  return res.status(201).json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    is_active: user.is_active,
    last_login_at: user.last_login_at || null,
    created_at: user.created_at,
  });
});

apiRouter.put('/users/:id', requireSuperAdmin, async (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const id = parseInt(req.params.id, 10);
  const { name, email, password, role, is_active } = req.body;

  const targetUser = dbService.getUserById(id);
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Prevent self-deactivation or self-demotion
  if (currentUser.id === id) {
    if (is_active !== undefined && is_active === 0) {
      return res.status(400).json({ error: 'You cannot deactivate your own Super Admin account' });
    }
    if (role !== undefined && role !== 'super_admin') {
      return res.status(400).json({ error: 'You cannot demote your own Super Admin role' });
    }
  }

  const dataToUpdate: any = {};
  if (name !== undefined) dataToUpdate.name = String(name).trim();
  if (email !== undefined) {
    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = dbService.getUserByEmail(normalizedEmail);
    if (existing && existing.id !== id) {
      return res.status(409).json({ error: 'Another user account already uses this email address' });
    }
    dataToUpdate.email = normalizedEmail;
  }
  if (role !== undefined) {
    const validRoles = ['super_admin', 'admin', 'staff'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid user role' });
    }
    dataToUpdate.role = role;
  }
  if (is_active !== undefined) {
    dataToUpdate.is_active = is_active ? 1 : 0;
  }
  if (password && String(password).trim().length > 0) {
    const strength = validatePasswordStrength(password);
    if (!strength.valid) {
      return res.status(400).json({ error: strength.reason });
    }
    dataToUpdate.password_hash = hashPassword(password);
  }

  const updated = await dbService.updateUser(id, dataToUpdate, currentUser.id);
  if (!updated) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    is_active: updated.is_active,
    last_login_at: updated.last_login_at || null,
    created_at: updated.created_at,
  });
});

apiRouter.delete('/users/:id', requireSuperAdmin, async (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const id = parseInt(req.params.id, 10);

  if (id === currentUser.id) {
    return res.status(400).json({ error: 'You cannot delete your own account while logged in.' });
  }

  try {
    const success = await dbService.deleteUser(id, currentUser.id);
    if (!success) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ message: 'User account removed successfully' });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Cannot delete user account' });
  }
});

// --------------------------------------------------------------------------
// Data Cleanup & Historical Purge Endpoints (Super Admin Only)
// Preserves All Client Profile Information
// --------------------------------------------------------------------------
apiRouter.post('/data-cleanup/preview', requireSuperAdmin, (req: Request, res: Response) => {
  const { startDate, endDate, targets } = req.body;

  if (!targets || typeof targets !== 'object') {
    return res.status(400).json({ error: 'Please specify target data categories to clean up' });
  }

  const preview = dbService.previewPurgeData({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    targets: {
      applications: Boolean(targets.applications),
      hotel_bookings: Boolean(targets.hotel_bookings),
      tasks: Boolean(targets.tasks),
      status_history: Boolean(targets.status_history),
      activity_logs: Boolean(targets.activity_logs),
    },
  });

  return res.json(preview);
});

apiRouter.post('/data-cleanup/purge', requireSuperAdmin, (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const { startDate, endDate, targets, confirmation } = req.body;

  if (confirmation !== 'DELETE' && confirmation !== 'PURGE' && confirmation !== true) {
    return res.status(400).json({
      error: 'Explicit purge confirmation required. Please confirm the deletion action.',
    });
  }

  if (!targets || typeof targets !== 'object') {
    return res.status(400).json({ error: 'Please specify target data categories to purge' });
  }

  const hasAnyTarget = Boolean(
    targets.applications || targets.hotel_bookings || targets.tasks || targets.status_history || targets.activity_logs
  );

  if (!hasAnyTarget) {
    return res.status(400).json({ error: 'Please select at least one data category to delete.' });
  }

  const result = dbService.purgeData(
    {
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      targets: {
        applications: Boolean(targets.applications),
        hotel_bookings: Boolean(targets.hotel_bookings),
        tasks: Boolean(targets.tasks),
        status_history: Boolean(targets.status_history),
        activity_logs: Boolean(targets.activity_logs),
      },
    },
    currentUser.id
  );

  return res.json(result);
});

// --------------------------------------------------------------------------
// Dashboard & Activity Endpoints
// --------------------------------------------------------------------------
apiRouter.get('/dashboard', (req: Request, res: Response) => {
  const metrics = dbService.getDashboardMetrics();
  return res.json(metrics);
});

apiRouter.get('/activity', (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 25;
  const logs = dbService.getActivityLogs(limit);
  return res.json(logs);
});

// --------------------------------------------------------------------------
// Database Status & SQL Backup / Restore Engine
// --------------------------------------------------------------------------
apiRouter.get('/db/status', async (req: Request, res: Response) => {
  const force = req.query.force === 'true';
  await dbService.syncFromMySQL(force);
  const status = dbService.getStatus();
  return res.json(status);
});

apiRouter.post('/db/sync', async (_req: Request, res: Response) => {
  try {
    const status = await dbService.syncFromMySQL(true);
    return res.json({
      message: 'Successfully synchronized live database records from MySQL',
      status,
    });
  } catch (err: any) {
    return res.status(500).json({ error: `Failed to sync from database: ${err.message}` });
  }
});

apiRouter.get('/db/backup', requireSuperAdmin, (_req: Request, res: Response) => {
  try {
    const sqlDump = dbService.generateFullSqlDump();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `sn_travels_full_backup_${timestamp}.sql`;

    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(sqlDump);
  } catch (err: any) {
    return res.status(500).json({ error: `Failed to generate database backup: ${err.message}` });
  }
});

apiRouter.post('/db/restore', requireSuperAdmin, (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const { dumpContent } = req.body;
    if (!dumpContent || typeof dumpContent !== 'string') {
      return res.status(400).json({ error: 'No SQL backup data provided for restoration' });
    }

    const result = dbService.restoreFromSqlDump(dumpContent, currentUser.id);
    return res.json({
      message: 'Database restored successfully from backup',
      restored: result.restored,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to restore database from backup file' });
  }
});

apiRouter.get('/db/schema-sql', (req: Request, res: Response) => {
  try {
    const schemaPath = path.resolve(process.cwd(), 'database/schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf-8');
      return res.type('text/plain').send(sql);
    }
    return res.status(404).send('-- schema.sql not found');
  } catch (err: any) {
    return res.status(500).send(`Error: ${err.message}`);
  }
});

apiRouter.get('/db/seed-sql', (req: Request, res: Response) => {
  try {
    const seedPath = path.resolve(process.cwd(), 'database/seed.sql');
    if (fs.existsSync(seedPath)) {
      const sql = fs.readFileSync(seedPath, 'utf-8');
      return res.type('text/plain').send(sql);
    }
    return res.status(404).send('-- seed.sql not found');
  } catch (err: any) {
    return res.status(500).send(`Error: ${err.message}`);
  }
});

// --------------------------------------------------------------------------
// Security & Secret Login URL Endpoints (Admin / Super Admin)
// --------------------------------------------------------------------------
apiRouter.get('/settings/secret-login-url', (req: Request, res: Response) => {
  const user = (req as any).user;
  if (user.role !== 'super_admin' && user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrative privileges required.' });
  }

  const settings = dbService.getSecretLoginSettings();
  return res.json(settings);
});

apiRouter.post('/settings/secret-login-url', (req: Request, res: Response) => {
  const user = (req as any).user;
  if (user.role !== 'super_admin' && user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrative privileges required.' });
  }

  const { enabled, secretKey } = req.body;
  const isEnabled = Boolean(enabled);
  const cleanKey = String(secretKey || '').trim().toLowerCase();

  if (isEnabled && cleanKey.length < 3) {
    return res.status(400).json({
      error: 'Secret URL key must be at least 3 characters long.',
    });
  }

  const updated = dbService.updateSecretLoginSettings(isEnabled, cleanKey || 'sn-secure-staff-2026', user.id);
  return res.json({
    message: 'Secret Login URL configuration updated successfully',
    ...updated,
  });
});

// --------------------------------------------------------------------------
// Hotel Endpoints
// --------------------------------------------------------------------------
apiRouter.get('/hotels', (req: Request, res: Response) => {
  const activeOnly = req.query.active_only === 'true';
  const hotels = dbService.getHotels(activeOnly);
  return res.json(hotels);
});

apiRouter.get('/hotels/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const hotel = dbService.getHotelById(id);
  if (!hotel) {
    return res.status(404).json({ error: 'Hotel not found' });
  }
  return res.json(hotel);
});

apiRouter.post('/hotels', async (req: Request, res: Response) => {
  const currentUser = getCurrentUser(req);
  const { name, city, address, star_rating, phone, email, notes } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Hotel name is required' });
  }

  const hotel = await dbService.createHotel(
    { name, city, address, star_rating, phone, email, notes },
    currentUser?.id || 1
  );
  return res.status(201).json(hotel);
});

apiRouter.put('/hotels/:id', async (req: Request, res: Response) => {
  const currentUser = getCurrentUser(req);
  const id = parseInt(req.params.id, 10);
  const updated = await dbService.updateHotel(id, req.body, currentUser?.id || 1);
  if (!updated) {
    return res.status(404).json({ error: 'Hotel not found' });
  }
  return res.json(updated);
});

apiRouter.delete('/hotels/:id', async (req: Request, res: Response) => {
  const currentUser = getCurrentUser(req);
  const id = parseInt(req.params.id, 10);
  const ok = await dbService.deleteHotel(id, currentUser?.id || 1);
  if (!ok) {
    return res.status(404).json({ error: 'Hotel not found' });
  }
  return res.json({ success: true, message: 'Hotel deleted successfully' });
});

// --------------------------------------------------------------------------
// Hotel Room Types Endpoints
// --------------------------------------------------------------------------
apiRouter.get('/hotels/:id/rooms', (req: Request, res: Response) => {
  const hotelId = parseInt(req.params.id, 10);
  const activeOnly = req.query.active_only === 'true';
  const rooms = dbService.getHotelRooms(hotelId, activeOnly);
  return res.json(rooms);
});

apiRouter.post('/hotels/:id/rooms', async (req: Request, res: Response) => {
  const currentUser = getCurrentUser(req);
  const hotelId = parseInt(req.params.id, 10);
  const { name, price_per_night, currency, capacity, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Room type name is required' });
  }

  const room = await dbService.createHotelRoom(
    hotelId,
    { name, price_per_night, currency, capacity, description },
    currentUser?.id || 1
  );
  return res.status(201).json(room);
});

apiRouter.put('/hotel-rooms/:id', async (req: Request, res: Response) => {
  const currentUser = getCurrentUser(req);
  const id = parseInt(req.params.id, 10);
  const updated = await dbService.updateHotelRoom(id, req.body, currentUser?.id || 1);
  if (!updated) {
    return res.status(404).json({ error: 'Room type not found' });
  }
  return res.json(updated);
});

apiRouter.delete('/hotel-rooms/:id', async (req: Request, res: Response) => {
  const currentUser = getCurrentUser(req);
  const id = parseInt(req.params.id, 10);
  const ok = await dbService.deleteHotelRoom(id, currentUser?.id || 1);
  if (!ok) {
    return res.status(404).json({ error: 'Room type not found' });
  }
  return res.json({ success: true, message: 'Room type deleted successfully' });
});

// --------------------------------------------------------------------------
// Hotel Bookings / Customer Assignment Endpoints
// --------------------------------------------------------------------------
apiRouter.get('/hotel-bookings', (req: Request, res: Response) => {
  const { client_id, hotel_id, status, search } = req.query;
  const bookings = dbService.getHotelBookings({
    clientId: client_id ? parseInt(client_id as string, 10) : undefined,
    hotelId: hotel_id ? parseInt(hotel_id as string, 10) : undefined,
    status: typeof status === 'string' ? status : undefined,
    search: typeof search === 'string' ? search : undefined,
  });
  return res.json(bookings);
});

apiRouter.get('/hotel-bookings/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const booking = dbService.getHotelBookingById(id);
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }
  return res.json(booking);
});

apiRouter.post('/hotel-bookings', async (req: Request, res: Response) => {
  const currentUser = getCurrentUser(req);
  const {
    client_id,
    hotel_id,
    room_type_id,
    room_type_name,
    check_in_date,
    check_out_date,
    guest_count,
    room_count,
    status,
    comment,
    special_requests,
    total_price,
    currency,
  } = req.body;

  if (!client_id) {
    return res.status(400).json({ error: 'Please select a customer to assign the hotel' });
  }
  if (!hotel_id) {
    return res.status(400).json({ error: 'Please select a hotel' });
  }
  if (!check_in_date || !check_out_date) {
    return res.status(400).json({ error: 'Check-in and Check-out dates are required' });
  }

  // Validate check-out date is not before check-in date
  if (check_out_date < check_in_date) {
    return res.status(400).json({ error: 'Check-out date cannot be earlier than check-in date' });
  }

  try {
    const booking = await dbService.createHotelBooking(
      {
        client_id: parseInt(client_id, 10),
        hotel_id: parseInt(hotel_id, 10),
        room_type_id: room_type_id ? parseInt(room_type_id, 10) : undefined,
        room_type_name,
        check_in_date,
        check_out_date,
        guest_count: guest_count ? parseInt(guest_count, 10) : 1,
        room_count: room_count ? parseInt(room_count, 10) : 1,
        status,
        comment,
        special_requests,
        total_price,
        currency,
      },
      currentUser?.id || 1
    );
    return res.status(201).json(booking);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to assign hotel booking' });
  }
});

apiRouter.put('/hotel-bookings/:id', async (req: Request, res: Response) => {
  const currentUser = getCurrentUser(req);
  const id = parseInt(req.params.id, 10);
  const { check_in_date, check_out_date } = req.body;

  if (check_in_date && check_out_date && check_out_date < check_in_date) {
    return res.status(400).json({ error: 'Check-out date cannot be earlier than check-in date' });
  }

  const updated = await dbService.updateHotelBooking(id, req.body, currentUser?.id || 1);
  if (!updated) {
    return res.status(404).json({ error: 'Booking not found' });
  }
  return res.json(updated);
});

apiRouter.delete('/hotel-bookings/:id', async (req: Request, res: Response) => {
  const currentUser = getCurrentUser(req);
  const id = parseInt(req.params.id, 10);
  const ok = await dbService.deleteHotelBooking(id, currentUser?.id || 1);
  if (!ok) {
    return res.status(404).json({ error: 'Booking not found' });
  }
  return res.json({ success: true, message: 'Hotel booking deleted successfully' });
});

// --------------------------------------------------------------------------
// Image Proxy Endpoint for Google Drive & External Images
// --------------------------------------------------------------------------
apiRouter.get('/proxy-image', async (req: Request, res: Response) => {
  const imageUrl = req.query.url as string;
  if (!imageUrl || typeof imageUrl !== 'string') {
    return res.status(400).send('Missing url parameter');
  }

  // Security: Guard against SSRF (Server-Side Request Forgery)
  // Ensure the URL is an absolute http/https URL and block local/loopback/private IP addresses
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(imageUrl);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return res.status(400).send('Invalid protocol');
    }
    const hostname = parsedUrl.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local') ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
      /^169\.254\./.test(hostname)
    ) {
      return res.status(403).send('Restricted destination');
    }
  } catch (err) {
    return res.status(400).send('Malformed URL');
  }

  // Extract Google Drive File ID if present
  let candidateUrls: string[] = [];
  const driveFileMatch = imageUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  const driveIdMatch = imageUrl.match(/drive\.google\.com\/(?:open|uc|thumbnail)\?(?:[a-zA-Z0-9_=&-]*)*id=([a-zA-Z0-9_-]+)/i);
  const lh3Match = imageUrl.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/i);

  const fileId = (driveFileMatch && driveFileMatch[1]) || (driveIdMatch && driveIdMatch[1]) || (lh3Match && lh3Match[1]);

  if (fileId) {
    candidateUrls = [
      `https://lh3.googleusercontent.com/d/${fileId}`,
      `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
      `https://drive.google.com/uc?export=download&id=${fileId}`,
      `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`,
    ];
  } else if (imageUrl.includes('dropbox.com')) {
    candidateUrls = [imageUrl.replace('dl=0', 'raw=1')];
  } else {
    candidateUrls = [imageUrl];
  }

  for (const targetUrl of candidateUrls) {
    try {
      const response = await fetch(targetUrl, {
        signal: AbortSignal.timeout(8000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
      });

      if (response.ok) {
        const contentLength = Number(response.headers.get('content-length') || 0);
        if (contentLength > 15 * 1024 * 1024) {
          continue; // Skip oversized response
        }
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        if (contentType.includes('image') || contentType.includes('octet-stream')) {
          const buffer = await response.arrayBuffer();
          if (buffer.byteLength > 15 * 1024 * 1024) {
            continue;
          }
          res.setHeader('Content-Type', contentType.includes('image') ? contentType : 'image/jpeg');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          return res.send(Buffer.from(buffer));
        }
      }
    } catch (e) {
      console.warn(`[ImageProxy] Failed to fetch target URL: ${targetUrl}`, e);
    }
  }

  // Fallback SVG avatar placeholder if private/failed
  res.setHeader('Content-Type', 'image/svg+xml');
  return res.send(`
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="#0f172a"/>
      <circle cx="100" cy="80" r="40" fill="#38bdf8"/>
      <path d="M 30 180 C 30 130, 170 130, 170 180 Z" fill="#38bdf8"/>
    </svg>
  `);
});

// --------------------------------------------------------------------------
// 404 Fallback for unmatched API routes
// --------------------------------------------------------------------------
apiRouter.use((_req: Request, res: Response) => {
  return res.status(404).json({ error: 'API endpoint not found', status: 404 });
});
