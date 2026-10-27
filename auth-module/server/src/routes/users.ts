import { Router, Response } from 'express';
import { Types } from 'mongoose';
import { User } from '../models/User';
import { RefreshToken } from '../models/RefreshToken';
import { verifyToken, requireRole, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /users (admin, manager)
router.get(
  '/',
  verifyToken,
  requireRole('admin', 'manager'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const users = await User.find().sort({ createdAt: -1 });
      res.status(200).json(users);
    } catch (error) {
      console.error('[Users] Fetch users error:', error);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch users',
      });
    }
  }
);

// DELETE /users/:id (admin only)
router.delete(
  '/:id',
  verifyToken,
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = String(req.params.id);

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({
        code: 'BAD_REQUEST',
        message: 'Invalid user ID format',
      });
      return;
    }

    if (req.user?.sub === id) {
      res.status(400).json({
        code: 'CANNOT_DELETE_SELF',
        message: 'You cannot delete your own account',
      });
      return;
    }

    try {
      const user = await User.findByIdAndDelete(id);
      if (!user) {
        res.status(404).json({
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        });
        return;
      }

      // Delete all refresh tokens belonging to the deleted user
      await RefreshToken.deleteMany({ userId: id });

      res.status(204).send();
    } catch (error) {
      console.error('[Users] Delete user error:', error);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete user',
      });
    }
  }
);

export default router;
