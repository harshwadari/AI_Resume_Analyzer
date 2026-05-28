/**
 * validate — Generic Zod validation middleware.
 *
 * Takes a Zod schema and returns Express middleware that validates
 * req.body against that schema. On failure, responds with a 400
 * containing the first validation error message.
 *
 * Usage in routes:
 *   router.post("/register", validate(registerSchema), registerController)
 */
const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
        // Zod v4 uses .issues, Zod v3 uses .errors — support both
        const issues = result.error.issues || result.error.errors || [];
        const firstError = issues[0];
        return res.status(400).json({
            success: false,
            message: firstError?.message || "Validation failed",
        });
    }

    // Replace req.body with parsed/cleaned data (trims strings, etc.)
    req.body = result.data;
    next();
};

module.exports = validate;
