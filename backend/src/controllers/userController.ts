import { type Request, type Response } from 'express';
import { UserService } from '../services/userService';
import { comparePassword } from '../utils/password';
import { generateToken, generateRefreshToken, verifyToken } from '../utils/jwt';
import { createUserSchema } from '../types';

export const createUser = async (req: Request, res: Response) => {
  try {
    const { username, email, password } = createUserSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await UserService.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    console.log('Creating user:', { username, email }); // Debug log

    // Create user
    const newUser = await UserService.create({ username, email, password });

    console.log('User created successfully:', { id: newUser.id, username: newUser.username }); // Debug log

    // Generate token
    const token = generateToken({ userId: newUser.id, email: newUser.email });
    const refreshToken = generateRefreshToken({ userId: newUser.id, email: newUser.email });
    
    // Save refresh token to DB
    await UserService.updateRefreshToken(newUser.id, refreshToken);

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        avatarUrl: newUser.avatarUrl
      },
      token,
      refreshToken,
    });
  } catch (error: any) {
    console.error('Error creating user:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const loginUser = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await UserService.findByEmail(email);
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Compare password
    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Update last login time
    await UserService.updateLastLogin(user.id);

    // Generate token
    const token = generateToken({ userId: user.id, email: user.email });
    const refreshToken = generateRefreshToken({ userId: user.id, email: user.email });

    // Save refresh token
    await UserService.updateRefreshToken(user.id, refreshToken);

    res.status(200).json({
      message: 'Login successful',
      user: { id: user.id, username: user.username, email: user.email, avatarUrl: user.avatarUrl },
      token,
      refreshToken,
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId; // userId is added by auth middleware
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const user = await UserService.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        bio: user.bio,
        avatarUrl: user.avatarUrl
      },
    });
  } catch (error) {
    console.error('Error getting current user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const logoutUser = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId; 
    // Even if no userId was provided or valid, we return success for logout
    if (userId) {
      await UserService.updateRefreshToken(userId, null);
    }
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error logging out:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const refreshUserToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    try {
      const decoded = verifyToken(refreshToken);
      const user = await UserService.findById(decoded.userId);
      
      if (!user || user.refreshToken !== refreshToken) {
          return res.status(403).json({ error: 'Invalid refresh token' });
      }

      const token = generateToken({ userId: user.id, email: user.email });
      res.status(200).json({ accessToken: token });
    } catch(err) {
      return res.status(403).json({ error: 'Invalid or expired refresh token' });
    }
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { username, email, bio } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const updatedUser = await UserService.updateProfile(userId, { username, email, bio });
    
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        bio: updatedUser.bio,
        avatarUrl: updatedUser.avatarUrl
      }
    });

  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateAvatar = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { avatarUrl } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!avatarUrl) {
      return res.status(400).json({ error: 'Avatar URL required' });
    }

    const updatedUser = await UserService.updateAvatar(userId, avatarUrl);
    
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({
      message: 'Avatar updated successfully',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        bio: updatedUser.bio,
        avatarUrl: updatedUser.avatarUrl
      }
    });

  } catch (error) {
    console.error('Error updating avatar:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};