import type { APIRoute } from 'astro';
import { initDB } from '../../../lib/config/database';
import { hashPassword, generateToken, sanitizeUser } from '../../../lib/auth';
import mongoose from 'mongoose';
const { models } = mongoose;
import type { User } from '../../../types/user';

// Create User model if it doesn't exist
const UserSchema = new mongoose.Schema<User>({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const UserModel = models.User || mongoose.model<User>('User', UserSchema);

export const POST: APIRoute = async ({ request }) => {
  try {
    // Initialize database connection
    await initDB();

    // Check content type
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return new Response(
        JSON.stringify({ message: 'Content-Type must be application/json' }),
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return new Response(
        JSON.stringify({ message: 'Invalid JSON payload' }),
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }

    const { username, email, password } = body;

    // Validate input
    if (!username || !email || !password) {
      return new Response(
        JSON.stringify({ 
          message: 'All fields are required',
          details: {
            username: !username ? 'Username is required' : null,
            email: !email ? 'Email is required' : null,
            password: !password ? 'Password is required' : null
          }
        }),
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ message: 'Invalid email format' }),
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Check if user already exists
    const existingUser = await UserModel.findOne({ 
      $or: [{ email }, { username }] 
    });

    if (existingUser) {
      return new Response(
        JSON.stringify({ 
          message: 'User already exists',
          details: {
            email: existingUser.email === email ? 'Email already in use' : null,
            username: existingUser.username === username ? 'Username already taken' : null
          }
        }),
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Hash password and create user
    const hashedPassword = await hashPassword(password);
    const now = new Date();
    
    const newUser = new UserModel({
      username,
      email,
      password: hashedPassword,
      createdAt: now,
      updatedAt: now
    });

    await newUser.save();

    // Generate token and return user data
    const sanitizedUser = sanitizeUser(newUser.toObject());
    const token = generateToken(sanitizedUser);

    return new Response(
      JSON.stringify({ user: sanitizedUser, token }),
      { 
        status: 201,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Signup error:', error);
    return new Response(
      JSON.stringify({ 
        message: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
};