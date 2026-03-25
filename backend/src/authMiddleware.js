/**
 * Supabase JWT verification middleware.
 * Expects: Authorization: Bearer <access_token>
 */
function createRequireUser(supabase) {
  return async function requireUser(req, res, next) {
    try {
      const authHeader = req.headers.authorization || "";
      const token =
        authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : null;

      if (!token) {
        return res.status(401).json({
          success: false,
          message: "Missing Authorization Bearer token",
        });
      }

      const { data, error } = await supabase.auth.getUser(token);

      if (error || !data?.user) {
        return res.status(401).json({
          success: false,
          message: "Invalid token",
        });
      }

      req.user = { id: data.user.id, email: data.user.email || null };
      return next();
    } catch (e) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }
  };
}

module.exports = { createRequireUser };

