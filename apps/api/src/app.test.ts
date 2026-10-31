import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from './app.js';
import { signAccessToken } from './auth.js';

describe('foundation API', () => {
  it('reports process liveness without requiring external services', async () => {
    const response = await request(app).get('/api/v1/health/live');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('rejects private routes without a valid access token', async () => {
    const response = await request(app).get('/api/v1/auth/me');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('enforces the administrator role on privileged routes', async () => {
    const customerToken = signAccessToken({ id: '507f1f77bcf86cd799439011', name: 'Test Customer', email: 'customer@example.test', role: 'CUSTOMER' });
    const denied = await request(app).get('/api/v1/admin/ping').set('Authorization', `Bearer ${customerToken}`);
    expect(denied.status).toBe(403);
    const adminToken = signAccessToken({ id: '507f1f77bcf86cd799439012', name: 'Test Admin', email: 'admin@example.test', role: 'ADMIN' });
    const allowed = await request(app).get('/api/v1/admin/ping').set('Authorization', `Bearer ${adminToken}`);
    expect(allowed.status).toBe(200);
    expect(allowed.body).toEqual({ access: 'admin' });
  });

  it('rejects a malformed JWT instead of trusting supplied role headers', async () => {
    const response = await request(app).get('/api/v1/admin/ping').set('Authorization', 'Bearer forged.admin.token');
    expect(response.status).toBe(401);
  });

  it('accepts access token passed via query parameter (token=...) for direct link downloads', async () => {
    const customerToken = signAccessToken({ id: '507f1f77bcf86cd799439011', name: 'Test Customer', email: 'customer@example.test', role: 'CUSTOMER' });
    const response = await request(app).get(`/api/v1/auth/me?token=${customerToken}`);
    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe('customer@example.test');
  });

});
