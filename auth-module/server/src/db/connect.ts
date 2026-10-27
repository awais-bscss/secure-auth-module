import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';

export async function connectDB(uri: string): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return;
  }
  try {
    await mongoose.connect(uri);
    console.log('[Database] Connected to MongoDB successfully.');

    // Ensure all 3 required demo accounts exist (idempotent seed)
    const demoUsers = [
      {
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'admin' as const,
        plainPass: 'Admin@123',
      },
      {
        name: 'Manager User',
        email: 'manager@example.com',
        role: 'manager' as const,
        plainPass: 'Manager@123',
      },
      {
        name: 'Viewer User',
        email: 'viewer@example.com',
        role: 'viewer' as const,
        plainPass: 'Viewer@123',
      },
    ];

    const saltRounds = 10;
    for (const demo of demoUsers) {
      const exists = await User.findOne({ email: demo.email });
      if (!exists) {
        await User.create({
          name: demo.name,
          email: demo.email,
          role: demo.role,
          passwordHash: await bcrypt.hash(demo.plainPass, saltRounds),
        });
        console.log(`[Database] Seeded missing demo account: ${demo.email} (${demo.role})`);
      }
    }
  } catch (error) {
    console.error('[Database] Failed to connect to MongoDB:', error);
    if (!process.env.VERCEL) {
      process.exit(1);
    }
    throw error;
  }
}
