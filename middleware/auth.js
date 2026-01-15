const jwt = require("jsonwebtoken");
const Doctor = require("../modal/Doctor");
const Patient = require("../modal/Patient");

module.exports = {
  authenticate: async (req, res, next) => {
    try {
      const header = req.headers.authorization || req.headers.Authorization;

      if (!header) {
        console.error("Auth Error: Missing Authorization header");
        return res.unauthorized("Missing token");
      }

      if (!header.startsWith("Bearer ")) {
        console.error("Auth Error: Invalid Authorization header format");
        return res.unauthorized("Invalid token format");
      }

      const token = header.slice(7);

      if (!token) {
        console.error("Auth Error: Empty token");
        return res.unauthorized("Missing token");
      }

      if (!process.env.JWT_SECRET) {
        console.error("Auth Error: JWT_SECRET is not configured");
        return res.serverError("Server configuration error");
      }

      const decode = jwt.verify(token, process.env.JWT_SECRET);
      req.auth = decode;

      if (decode.type === "doctor") {
        req.user = await Doctor.findById(decode.id);
      } else if (decode.type === "patient") {
        req.user = await Patient.findById(decode.id);
      }

      if (!req.user) {
        console.error(
          `Auth Error: User not found - ID: ${decode.id}, Type: ${decode.type}`
        );
        return res.unauthorized("Invalid user");
      }

      next();
    } catch (error) {
      console.error("Auth Error:", error.message);
      if (error.name === "JsonWebTokenError") {
        return res.unauthorized("Invalid token");
      } else if (error.name === "TokenExpiredError") {
        return res.unauthorized("Token expired");
      }
      return res.unauthorized("Invalid or expired token");
    }
  },
  requireRole: (role) => (req, res, next) => {
    if (!req.auth || req.auth.type !== role) {
      return res.forbidden("Insufficient role permissions");
    }
    next();
  },
};
