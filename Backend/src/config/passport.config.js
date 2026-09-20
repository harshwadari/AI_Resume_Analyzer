const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { resolveGoogleUser } = require('../services/google-auth.service');

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: require('./auth.config').authConfig().googleCallback,
    passReqToCallback: true,
}, async (req, accessToken, refreshToken, profile, done) => {
    try { done(null, await resolveGoogleUser(profile, req.oauthLinkUserId, req.oauthLinkVersion)); }
    catch (err) { done(err); }
}));
module.exports = passport;
