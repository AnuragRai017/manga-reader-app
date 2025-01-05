import type { APIRoute } from 'astro';
import mongoose from 'mongoose';
import { initDB } from '../../../lib/config/database';
import { comparePasswords, generateToken, sanitizeUser } from '../../../lib/auth';
import type { User } from '../../../types/user';

// Create User Schema if it doesn't exist
const UserSchema = new mongoose.Schema<User>({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const UserModel = mongoose.models.User || mongoose.model<User>('User', UserSchema);

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return new Response(
        JSON.stringify({ message: 'Email and password are required' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Connect to database
    await initDB();

    // Find user using UserModel instead of MangaModel
    const user = await UserModel.findOne({ email });

    if (!user) {
      return new Response(
        JSON.stringify({ message: 'Invalid credentials' }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Verify password
    const isValidPassword = await comparePasswords(password, user.password);

    if (!isValidPassword) {
      return new Response(
        JSON.stringify({ message: 'Invalid credentials' }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Generate token and return user data
    const sanitizedUser = sanitizeUser(user.toObject());
    const token = generateToken(sanitizedUser);

    return new Response(
      JSON.stringify({ user: sanitizedUser, token }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Login error:', error);
    return new Response(
      JSON.stringify({ 
        message: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};