import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import User from '../models/User';

export const configurePassport = () => {
  // Google Strategy
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID || 'placeholder',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'placeholder',
        callbackURL: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/google/callback`,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0].value;
          if (!email) return done(new Error('No email found in Google profile'));

          let user = await User.findOne({ 
            $or: [{ googleId: profile.id }, { email }] 
          });

          if (user) {
            if (!user.googleId) {
              user.googleId = profile.id;
              if (!user.avatar) user.avatar = profile.photos?.[0].value;
              await user.save();
            }
            return done(null, user);
          }

          // Create new user if not found
          user = await User.create({
            username: profile.displayName.replace(/\s+/g, '_').toLowerCase() + '_' + Math.floor(Math.random() * 1000),
            email,
            googleId: profile.id,
            avatar: profile.photos?.[0].value,
          });

          done(null, user);
        } catch (error) {
          done(error);
        }
      }
    )
  );

  // GitHub Strategy
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID || 'placeholder',
        clientSecret: process.env.GITHUB_CLIENT_SECRET || 'placeholder',
        callbackURL: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/github/callback`,
      },
      async (accessToken: string, refreshToken: string, profile: any, done: any) => {
        try {
          const email = profile.emails?.[0].value || `${profile.username}@github.com`;
          
          let user = await User.findOne({ 
            $or: [{ githubId: profile.id }, { email }] 
          });

          if (user) {
            if (!user.githubId) {
              user.githubId = profile.id;
              if (!user.avatar) user.avatar = profile.photos?.[0].value;
              await user.save();
            }
            return done(null, user);
          }

          // Create new user
          user = await User.create({
            username: profile.username || profile.displayName.replace(/\s+/g, '_').toLowerCase(),
            email,
            githubId: profile.id,
            avatar: profile.photos?.[0].value,
          });

          done(null, user);
        } catch (error) {
          done(error);
        }
      }
    )
  );

  // We don't need serialize/deserialize if we are using JWT, 
  // but passport expects them if session is true. We'll use session: false in routes.
};
