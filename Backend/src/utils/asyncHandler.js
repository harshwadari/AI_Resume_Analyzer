/**
 * asyncHandler — Eliminates try-catch boilerplate in async controllers.
 *
 * Wraps an async function and forwards any thrown/rejected error
 * to Express's global error handler via next(err).
 *
 * Usage:
 *   router.get("/route", asyncHandler(async (req, res) => { ... }))
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
