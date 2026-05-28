const { z } = require("zod");

/**
 * Zod Validation Schemas for all auth endpoints.
 *
 * Each schema validates and sanitizes the request body.
 * The validate middleware (validate.middleware.js) applies these
 * before the request reaches the controller.
 */

const registerSchema = z.object({
    username: z
        .string({ required_error: "Username is required" })
        .trim()
        .min(3, "Username must be at least 3 characters")
        .max(30, "Username must be at most 30 characters"),
    email: z
        .string({ required_error: "Email is required" })
        .trim()
        .toLowerCase()
        .email("Please enter a valid email"),
    password: z
        .string({ required_error: "Password is required" })
        .min(8, "Password must be at least 8 characters")
        .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
            "Password must contain at least 1 lowercase, 1 uppercase, and 1 number"
        ),
});

const loginSchema = z.object({
    email: z
        .string({ required_error: "Email is required" })
        .trim()
        .toLowerCase()
        .email("Please enter a valid email"),
    password: z
        .string({ required_error: "Password is required" })
        .min(1, "Password is required"),
});

const verifyOtpSchema = z.object({
    email: z
        .string({ required_error: "Email is required" })
        .trim()
        .toLowerCase()
        .email("Please enter a valid email"),
    otp: z
        .string({ required_error: "OTP is required" })
        .length(6, "OTP must be exactly 6 digits"),
});

const resendOtpSchema = z.object({
    email: z
        .string({ required_error: "Email is required" })
        .trim()
        .toLowerCase()
        .email("Please enter a valid email"),
});

const forgotPasswordSchema = z.object({
    email: z
        .string({ required_error: "Email is required" })
        .trim()
        .toLowerCase()
        .email("Please enter a valid email"),
});

const resetPasswordSchema = z.object({
    token: z
        .string({ required_error: "Reset token is required" })
        .min(1, "Reset token is required"),
    password: z
        .string({ required_error: "Password is required" })
        .min(8, "Password must be at least 8 characters")
        .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
            "Password must contain at least 1 lowercase, 1 uppercase, and 1 number"
        ),
});

const contactSchema = z.object({
    name: z
        .string({ required_error: "Name is required" })
        .trim()
        .min(1, "Name is required"),
    email: z
        .string({ required_error: "Email is required" })
        .trim()
        .toLowerCase()
        .email("Please enter a valid email"),
    message: z
        .string({ required_error: "Message is required" })
        .trim()
        .min(10, "Message must be at least 10 characters long"),
});

module.exports = {
    registerSchema,
    loginSchema,
    verifyOtpSchema,
    resendOtpSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    contactSchema,
};
