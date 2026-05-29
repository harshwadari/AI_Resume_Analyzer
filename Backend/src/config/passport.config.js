const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const userModel = require("../models/user.model");

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: `${process.env.BACKEND_URL || "https://ai-resume-analyzer-2xdy.onrender.com"}/api/auth/google/callback`,
            proxy: true,
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                // Find user by googleId
                let user = await userModel.findOne({ googleId: profile.id });

                if (user) {
                    return done(null, user);
                }

                // If not found by googleId, find user by email
                const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
                if (!email) {
                    return done(new Error("Email not returned by Google"), null);
                }

                user = await userModel.findOne({ email });

                if (user) {
                    // Link Google account to existing local account
                    user.googleId = profile.id;
                    user.authProvider = "google";
                    if (profile.photos && profile.photos[0]) {
                        user.avatar = profile.photos[0].value;
                    }
                    // Google OAuth verifies the email, so we set isVerified to true
                    user.isVerified = true;
                    await user.save();
                    return done(null, user);
                }

                // Create new user if not exists
                user = await userModel.create({
                    username: profile.displayName || email.split("@")[0],
                    email: email,
                    googleId: profile.id,
                    authProvider: "google",
                    isVerified: true,
                    avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
                });

                return done(null, user);
            } catch (err) {
                return done(err, null);
            }
        }
    )
);

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await userModel.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

module.exports = passport;
