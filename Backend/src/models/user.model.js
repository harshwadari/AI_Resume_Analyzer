const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({

    username:{
        type:String,
        required:[true,"username is required"],
        unique:true,
        trim:true,
        minlength:[3,"minimum 3 characters"]
    },

    email:{
        type:String,
        required:[true,"email is required"],
        unique:true,
        lowercase:true,
        trim:true,
        match:[
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            "Please enter valid email"
        ]
    },

    password:{
        type:String,
        // Conditionally required: local users must have a password,
        // Google OAuth users will not have one
        required:[
            function () { return this.authProvider === "local"; },
            "password is required"
        ],
        // NOTE: Password format validation (regex, minlength) is handled by
        // Zod schemas BEFORE reaching the model. We removed Mongoose match/minlength
        // validators here because the pre-save hook hashes the password with bcrypt,
        // and the hashed value would always fail the original regex check.
    },

    // ── Email Verification Fields ──
    isVerified: {
        type: Boolean,
        default: false,
    },
    otp: {
        type: String,
        default: null,
    },
    otpExpiry: {
        type: Date,
        default: null,
    },

    // ── Forgot Password Fields ──
    resetPasswordToken: {
        type: String,
        default: null,
    },
    resetPasswordExpiry: {
        type: Date,
        default: null,
    },

    // ── Google OAuth Fields ──
    googleId: {
        type: String,
        default: null,
    },
    authProvider: {
        type: String,
        enum: ["local", "google"],
        default: "local",
    },
    avatar: {
        type: String,
        default: null,
    },

    // ── Role-Based Access ──
    role: {
        type: String,
        enum: ["user", "admin"],
        default: "user",
    },

}, {
    timestamps: true
});

/**
 * Pre-save hook — Hashes the password before saving to the database.
 *
 * Only runs when the password field has been modified (or is new).
 * This prevents re-hashing an already-hashed password on updates
 * to other fields like isVerified or otp.
 *
 * Uses bcrypt with 10 salt rounds (industry standard).
 */
userSchema.pre("save", async function () {
    // Skip if password wasn't changed or doesn't exist (Google OAuth users)
    if (!this.isModified("password") || !this.password) return;

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

/**
 * Instance method — Compares a plain-text password with the hashed one.
 * Used in loginUserController to verify credentials.
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

const userModel = mongoose.model("users", userSchema);

module.exports = userModel;