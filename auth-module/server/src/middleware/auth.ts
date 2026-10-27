import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface TokenPayload {
  sub: string;
  role: 'admin' | 'manager' | 'viewer';
}

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export function verifyToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      code: 'TOKEN_INVALID',
      message: 'Access token missing or invalid format',
    });
    return;
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.ACCESS_TOKEN_SECRET;

  if (!secret) {
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Server configuration error: ACCESS_TOKEN_SECRET missing',
    });
    return;
  }

  jwt.verify(token, secret, { algorithms: ['HS256'] }, (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        res.status(401).json({
          code: 'TOKEN_EXPIRED',
          message: 'Access token has expired',
        });
        return;
      }
      res.status(401).json({
        code: 'TOKEN_INVALID',
        message: 'Access token is invalid',
      });
      return;
    }

    req.user = decoded as TokenPayload;
    next();
  });
}

export function requireRole(...roles: Array<'admin' | 'manager' | 'viewer'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: 'You do not have required permissions to perform this action',
      });
      return;
    }
    next();
  };
}

export function requireCsrfHeader(req: Request, res: Response, next: NextFunction): void {
  const requestedWith = req.headers['x-requested-with'];
  if (requestedWith !== 'XMLHttpRequest') {
    res.status(403).json({
      code: 'CSRF_BLOCKED',
      message: 'Missing or invalid X-Requested-With header',
    });
    return;
  }
  next();
}
