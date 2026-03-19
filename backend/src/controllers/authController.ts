import type { Request, Response } from 'express';
import { google } from 'googleapis';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'postmessage'
);

export const googleLogin = async (req: Request, res: Response) => {
    try {
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({ message: 'Authorization code is required' });
        }

        const { tokens } = await oauth2Client.getToken(code);

        const ticket = await oauth2Client.verifyIdToken({
            idToken: tokens.id_token!,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();

        if (!payload || !payload.email) {
            return res.status(400).json({ message: 'Invalid Google token' });
        }

        const { email, sub: googleId, name, picture } = payload;

        const [existingUser] = await db.select().from(users).where(eq(users.email, email));

        let userId;
        let user;

        if (existingUser) {
            await db.update(users)
                .set({
                    googleId: googleId,
                    avatarUrl: picture || existingUser.avatarUrl,
                    refreshToken: tokens.refresh_token || existingUser.refreshToken,
                })
                .where(eq(users.id, existingUser.id));

            userId = existingUser.id;
            user = existingUser;
        } else {
            const username = name || email.split('@')[0];

            const [newUser] = await db.insert(users).values({
                email: email!,
                username: username || 'user_' + Date.now(),
                password: null,
                googleId: googleId || null,
                avatarUrl: picture || null,
                refreshToken: tokens.refresh_token || null,
            }).returning();

            if (!newUser) throw new Error('Failed to create user');

            userId = newUser.id;
            user = newUser;
        }

        if (!user) throw new Error('User not found');

        const token = jwt.sign(
            { userId, email },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        res.status(200).json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                googleId: user.googleId,
                avatarUrl: user.avatarUrl
            },
        });

    } catch (error: any) {
        console.error('Google login error:', error);
        res.status(500).json({ message: 'Google login failed', error: error.message });
    }
};
