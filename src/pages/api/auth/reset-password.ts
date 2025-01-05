import type { APIRoute } from 'astro';
import { connectDB, closeDB } from '../../../lib/db';
import { hashPassword } from '../../../lib/auth';
import type { User } from '../../../types/user';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

// Configure email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Request password reset
export const POST: APIRoute = async ({ request }) => {
  try {
    const { email } = await request.json();

    if (!email) {
      return new Response(
        JSON.stringify({ message: 'Email is required' }),
        { status: 400 }
      );
    }

    const db = await connectDB();
    const usersCollection = db.collection<User>('users');
    const resetTokensCollection = db.collection('resetTokens');

    // Find user
    const user = await usersCollection.findOne({ email });

    if (!user) {
      return new Response(
        JSON.stringify({ message: 'If an account exists, a reset link will be sent' }),
        { status: 200 }
      );
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date();
    expires.setHours(expires.getHours() + 1); // Token expires in 1 hour

    // Save reset token
    await resetTokensCollection.insertOne({
      userId: user._id,
      token,
      expires,
    });

    // Send reset email
    const resetLink = `${process.env.PUBLIC_SITE_URL}/reset-password?token=${token}`;
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'Password Reset Request',
      html: `
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    });

    return new Response(
      JSON.stringify({ message: 'If an account exists, a reset link will be sent' }),
      { status: 200 }
    );

  } catch (error) {
    console.error('Password reset request error:', error);
    return new Response(
      JSON.stringify({ message: 'Internal server error' }),
      { status: 500 }
    );
  } finally {
    await closeDB();
  }
};

// Reset password with token
export const PUT: APIRoute = async ({ request }) => {
  try {
    const { token, newPassword } = await request.json();

    if (!token || !newPassword) {
      return new Response(
        JSON.stringify({ message: 'Token and new password are required' }),
        { status: 400 }
      );
    }

    const db = await connectDB();
    const usersCollection = db.collection<User>('users');
    const resetTokensCollection = db.collection('resetTokens');

    // Find valid token
    const resetToken = await resetTokensCollection.findOne({
      token,
      expires: { $gt: new Date() },
    });

    if (!resetToken) {
      return new Response(
        JSON.stringify({ message: 'Invalid or expired reset token' }),
        { status: 400 }
      );
    }

    // Update password
    const hashedPassword = await hashPassword(newPassword);
    await usersCollection.updateOne(
      { _id: resetToken.userId },
      { 
        $set: { 
          password: hashedPassword,
          updatedAt: new Date()
        } 
      }
    );

    // Delete used token
    await resetTokensCollection.deleteOne({ _id: resetToken._id });

    return new Response(
      JSON.stringify({ message: 'Password has been reset successfully' }),
      { status: 200 }
    );

  } catch (error) {
    console.error('Password reset error:', error);
    return new Response(
      JSON.stringify({ message: 'Internal server error' }),
      { status: 500 }
    );
  } finally {
    await closeDB();
  }
}; 