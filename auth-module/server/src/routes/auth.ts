import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';
import { RefreshToken } from '../models/RefreshToken';
import { verifyToken, requireCsrfHeader, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

export function parseDurationToMs(durationStr: string): number {
  const trimmed = durationStr.trim();
  const match = trimmed.match(/^(\d+)([smhd]?)$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // fallback 7d
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return value * 1000;
  }
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getRefreshTokenCookieOptions(maxAgeMs: number) {
  const isCrossSite = process.env.COOKIE_CROSS_SITE === 'true';
  return {
    httpOnly: true,
    sameSite: isCrossSite ? ('none' as const) : ('strict' as const),
    path: '/auth',
    secure: process.env.NODE_ENV === 'production' || isCrossSite,
    maxAge: maxAgeMs,
  };
}

function getClearCookieOptions() {
  const isCrossSite = process.env.COOKIE_CROSS_SITE === 'true';
  return {
    httpOnly: true,
    sameSite: isCrossSite ? ('none' as const) : ('strict' as const),
    path: '/auth',
    secure: process.env.NODE_ENV === 'production' || isCrossSite,
  };
}

// POST /auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (
    !email ||
    !password ||
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    email.trim() === '' ||
    password.trim() === ''
  ) {
    res.status(401).json({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    });
    return;
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
      return;
    }

    const accessSecret = process.env.ACCESS_TOKEN_SECRET!;
    const refreshSecret = process.env.REFRESH_TOKEN_SECRET!;
    const accessTtl = process.env.ACCESS_TOKEN_TTL || '15m';
    const refreshTtl = process.env.REFRESH_TOKEN_TTL || '7d';
    const refreshTtlMs = parseDurationToMs(refreshTtl);

    // Issue access token
    const accessToken = jwt.sign(
      { sub: user._id.toString(), role: user.role },
      accessSecret,
      { expiresIn: accessTtl as any, algorithm: 'HS256' }
    );

    // Issue refresh token with crypto.randomUUID()
    const jti = crypto.randomUUID();
    const refreshToken = jwt.sign(
      { sub: user._id.toString(), jti },
      refreshSecret,
      { expiresIn: refreshTtl as any, algorithm: 'HS256' }
    );

    // Save refresh token hash in DB
    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + refreshTtlMs);

    await RefreshToken.create({
      tokenHash,
      userId: user._id,
      expiresAt,
    });

    // Set cookie
    res.cookie('refreshToken', refreshToken, getRefreshTokenCookieOptions(refreshTtlMs));

    // Return accessToken and user info
    res.status(200).json({
      accessToken,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred during login',
    });
  }
});

// POST /auth/refresh
router.post('/refresh', requireCsrfHeader, async (req: Request, res: Response): Promise<void> => {
  const rawRefreshToken = req.cookies?.refreshToken;

  if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
    res.status(401).json({
      code: 'REFRESH_INVALID',
      message: 'Refresh token missing or invalid',
    });
    return;
  }

  const refreshSecret = process.env.REFRESH_TOKEN_SECRET!;

  let decodedPayload: { sub: string; jti: string } | null = null;
  try {
    decodedPayload = jwt.verify(rawRefreshToken, refreshSecret, { algorithms: ['HS256'] }) as { sub: string; jti: string };
  } catch (err) {
    // Signature invalid or expired
    res.clearCookie('refreshToken', getClearCookieOptions());
    res.status(401).json({
      code: 'REFRESH_INVALID',
      message: 'Refresh token missing or invalid',
    });
    return;
  }

  const incomingTokenHash = hashToken(rawRefreshToken);

  try {
    // Atomic token rotation
    const existingTokenDoc = await RefreshToken.findOneAndDelete({ tokenHash: incomingTokenHash });

    if (!existingTokenDoc) {
      // Token reuse detected: revoke all sessions
      console.warn(`[Security Alert] Refresh token reuse detected for userId: ${decodedPayload.sub}`);
      await RefreshToken.deleteMany({ userId: decodedPayload.sub });
      res.clearCookie('refreshToken', getClearCookieOptions());
      res.status(401).json({
        code: 'REFRESH_REUSED',
        message: 'Refresh token reuse detected. All sessions revoked. Please log in again.',
      });
      return;
    }

    // Load user
    const user = await User.findById(existingTokenDoc.userId);
    if (!user) {
      res.clearCookie('refreshToken', getClearCookieOptions());
      res.status(401).json({
        code: 'REFRESH_INVALID',
        message: 'User no longer exists',
      });
      return;
    }

    const accessSecret = process.env.ACCESS_TOKEN_SECRET!;
    const accessTtl = process.env.ACCESS_TOKEN_TTL || '15m';
    const refreshTtl = process.env.REFRESH_TOKEN_TTL || '7d';
    const refreshTtlMs = parseDurationToMs(refreshTtl);

    // Issue new access token
    const newAccessToken = jwt.sign(
      { sub: user._id.toString(), role: user.role },
      accessSecret,
      { expiresIn: accessTtl as any, algorithm: 'HS256' }
    );

    // Issue new refresh token
    const newJti = crypto.randomUUID();
    const newRefreshToken = jwt.sign(
      { sub: user._id.toString(), jti: newJti },
      refreshSecret,
      { expiresIn: refreshTtl as any, algorithm: 'HS256' }
    );

    // Save new refresh token hash in DB
    const newTokenHash = hashToken(newRefreshToken);
    const expiresAt = new Date(Date.now() + refreshTtlMs);

    await RefreshToken.create({
      tokenHash: newTokenHash,
      userId: user._id,
      expiresAt,
    });

    // Set new cookie
    res.cookie('refreshToken', newRefreshToken, getRefreshTokenCookieOptions(refreshTtlMs));

    res.status(200).json({
      accessToken: newAccessToken,
    });
  } catch (error) {
    console.error('[Auth] Refresh error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred during token refresh',
    });
  }
});

// POST /auth/logout
router.post('/logout', requireCsrfHeader, async (req: Request, res: Response): Promise<void> => {
  const rawRefreshToken = req.cookies?.refreshToken;

  if (rawRefreshToken && typeof rawRefreshToken === 'string') {
    try {
      const incomingTokenHash = hashToken(rawRefreshToken);
      await RefreshToken.findOneAndDelete({ tokenHash: incomingTokenHash });
    } catch (err) {
      console.error('[Auth] Logout token deletion error:', err);
    }
  }

  res.clearCookie('refreshToken', getClearCookieOptions());
  res.status(204).send();
});

// GET /auth/me
router.get('/me', verifyToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.sub);
    if (!user) {
      res.status(401).json({
        code: 'TOKEN_INVALID',
        message: 'User not found',
      });
      return;
    }

    res.status(200).json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('[Auth] Me endpoint error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to retrieve user profile',
    });
  }
});

export default router;
