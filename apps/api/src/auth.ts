import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { config } from './config.js';
import type { Role } from './models.js';

export type Identity = { id: string; email: string; role: Role; name: string };
declare global { namespace Express { interface Request { identity?: Identity } } }

export function signAccessToken(user: Identity): string {
  return jwt.sign({ email: user.email, role: user.role, name: user.name }, config.JWT_ACCESS_SECRET, { subject: user.id, expiresIn: config.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'] });
}
export function makeRefreshToken(): string { return randomBytes(48).toString('base64url'); }
export function hashToken(value: string): string { return createHash('sha256').update(value).digest('hex'); }

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || (typeof req.query.token === 'string' ? req.query.token : undefined);
  if (!token) { res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue' } }); return; }
  try {
    const claims = jwt.verify(token, config.JWT_ACCESS_SECRET) as jwt.JwtPayload;
    if (!claims.sub || !['CUSTOMER', 'VENDOR', 'ADMIN'].includes(String(claims.role))) throw new Error('invalid claims');
    req.identity = { id: String(claims.sub), email: String(claims.email), role: claims.role as Role, name: String(claims.name) };
    next();
  } catch { res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Your session is invalid or expired' } }); }
}

export function requireRoles(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.identity || !roles.includes(req.identity.role)) { res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have access to this resource' } }); return; }
    next();
  };
}

export const refreshCookieOptions = () => ({ httpOnly: true, secure: config.COOKIE_SECURE === 'true' || config.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/api/v1/auth', maxAge: config.REFRESH_TOKEN_DAYS * 86400000 });
