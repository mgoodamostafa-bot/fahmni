import { Request, Response, Router } from 'express';
import { getAdminDb, strictLimiter, verifyPassword, hashPassword } from '../lib/middleware.js';
import { validateRequest } from '../lib/validateRequest.js';
import { hashPasswordSchema, tenantDeleteSchema, tenantSaveSchema, adminPromoteSchema } from '../../src/lib/validations.js';

const router = Router();

// ─── Super Admin Password Management ───────────────────────────
router.post('/admin/hash-password', strictLimiter, validateRequest({ body: hashPasswordSchema }), async (req: Request, res: Response) => {
  const { password } = req.body;

  try {
    const hashed = await hashPassword(password);
    res.json({ hashed });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Verify Super Admin Password (shared helper) ───────────────
async function verifySuperAdminPassword(password: string): Promise<boolean> {
  const adminDb = getAdminDb();
  if (!adminDb) return false;

  const settingsDoc = await adminDb.collection('super_admin').doc('settings').get();
  const storedPassword = settingsDoc.exists ? settingsDoc.data()?.password : null;
  if (!storedPassword) return false;

  if (storedPassword.includes(':')) {
    return verifyPassword(password, storedPassword);
  }
  return password === storedPassword;
}

// ─── Delete Tenant ─────────────────────────────────────────────
router.post('/tenants/delete', strictLimiter, validateRequest({ body: tenantDeleteSchema }), async (req: Request, res: Response) => {
  const { tenantId, superAdminPassword } = req.body;

  const adminDb = getAdminDb();
  if (!adminDb) {
    res.status(500).json({ error: 'Database connection failed' });
    return;
  }

  try {
    const valid = await verifySuperAdminPassword(superAdminPassword);
    if (!valid) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    await adminDb.collection('tenants').doc(tenantId).delete();
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting tenant:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Save/Update Tenant ────────────────────────────────────────
router.post('/tenants/save', strictLimiter, validateRequest({ body: tenantSaveSchema }), async (req: Request, res: Response) => {
  const { tenantData, oldTenantId, superAdminPassword } = req.body;

  const adminDb = getAdminDb();
  if (!adminDb) {
    res.status(500).json({ error: 'Database connection failed' });
    return;
  }

  try {
    const valid = await verifySuperAdminPassword(superAdminPassword);
    if (!valid) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const safeSubdomain = tenantData.subdomain.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
    await adminDb.collection('tenants').doc(safeSubdomain).set(
      { ...tenantData, subdomain: safeSubdomain, createdAt: tenantData.createdAt || new Date().toISOString() },
      { merge: true }
    );

    if (oldTenantId && oldTenantId !== safeSubdomain) {
      await adminDb.collection('tenants').doc(oldTenantId).delete();
    }

    res.json({ success: true, subdomain: safeSubdomain });
  } catch (error: any) {
    console.error('Error saving tenant:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Admin Promotion ───────────────────────────────────────────
router.post('/admin/promote', strictLimiter, validateRequest({ body: adminPromoteSchema }), async (req: Request, res: Response) => {
  const { uid, email, displayName } = req.body;

  const adminDb = getAdminDb();
  if (!adminDb) {
    res.status(500).json({ error: 'Database connection failed' });
    return;
  }

  try {
    const userRef = adminDb.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      await userRef.set({
        uid, email,
        displayName: displayName || 'Admin',
        role: 'admin',
        createdAt: new Date().toISOString()
      });
    } else {
      await userRef.set({ role: 'admin' }, { merge: true });
    }

    res.json({ success: true, message: 'User promoted to admin successfully' });
  } catch (error: any) {
    console.error('Error promoting admin:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
