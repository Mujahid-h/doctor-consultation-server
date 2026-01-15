// const express = require("express");
// const mongoose = require("mongoose");
// const helmet = require("helmet");
// const morgan = require("morgan");
// const cors = require("cors");
// const bodyParser = require("body-parser");
// require("dotenv").config();
// require("./config/passport");
// const passportLib = require("passport");

// const response = require("./middleware/response");

// const app = express();

// //helmet is a security middleware for Express
// //It helps protect your app by settings various HTTP headers
// app.use(helmet());

// //morgan is an HTTP request logger middleware
// app.use(morgan("dev"));

// // CORS configuration
// const allowedOrigins = process.env.ALLOWED_ORIGINS
//   ? process.env.ALLOWED_ORIGINS.split(",")
//       .map((s) => s.trim())
//       .filter(Boolean)
//   : ["http://localhost:3000"];

// console.log("Allowed CORS origins:", allowedOrigins);

// app.use(
//   cors({
//     origin: (origin, callback) => {
//       // Allow requests with no origin (like mobile apps or curl requests)
//       if (!origin) return callback(null, true);

//       if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
//         callback(null, true);
//       } else {
//         console.warn(`CORS blocked origin: ${origin}`);
//         callback(new Error("Not allowed by CORS"));
//       }
//     },
//     credentials: true,
//     methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization"],
//   })
// );
// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));

// //used response
// app.use(response);

// //Initialize passport
// app.use(passportLib.initialize());

// // Debug middleware to log auth headers (only in development)
// if (process.env.NODE_ENV !== "production") {
//   app.use((req, res, next) => {
//     if (req.path.startsWith("/api/") && !req.path.startsWith("/api/auth")) {
//       console.log(`[${req.method}] ${req.path}`);
//       console.log(
//         "Authorization header:",
//         req.headers.authorization ? "Present" : "Missing"
//       );
//     }
//     next();
//   });
// }

// //Mongodb connection
// mongoose
//   .connect(process.env.MONGO_URI, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//   })
//   .then(() => console.log("MongoDB connected"))
//   .catch((err) => console.error("MongoDB connection error:", err));

// app.use("/api/auth", require("./routes/auth"));
// app.use("/api/doctor", require("./routes/doctor"));
// app.use("/api/patient", require("./routes/patient"));
// app.use("/api/appointment", require("./routes/appointment"));
// app.use("/api/payment", require("./routes/payment"));

// app.get("/health", (req, res) =>
//   res.ok({ time: new Date().toISOString() }, "OK")
// );

// const PORT = process.env.PORT || 8000;
// app.listen(PORT, () => console.log(`Server listening on ${PORT}`));

const express = require("express");
const mongoose = require("mongoose");
const helmet = require("helmet");
const morgan = require("morgan");
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();
require("./config/passport");
const passportLib = require("passport");

const response = require("./middleware/response");

const app = express();

/* -------------------- Security & Logs -------------------- */
app.use(helmet());
app.use(morgan("dev"));

/* -------------------- CORS -------------------- */
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim())
  : ["http://localhost:3000"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        return callback(null, true);
      }

      console.warn(`CORS blocked origin: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/* -------------------- Custom Response -------------------- */
app.use(response);

/* -------------------- Passport -------------------- */
app.use(passportLib.initialize());

/* -------------------- Dev Debug -------------------- */
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/") && !req.path.startsWith("/api/auth")) {
      console.log(`[${req.method}] ${req.path}`);
      console.log(
        "Authorization header:",
        req.headers.authorization ? "Present" : "Missing"
      );
    }
    next();
  });
}

/* -------------------- MongoDB (Cached) -------------------- */
let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    isConnected = true;
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    throw err;
  }
};

app.use(async (req, res, next) => {
  await connectDB();
  next();
});

/* -------------------- Routes -------------------- */
app.use("/api/auth", require("./routes/auth"));
app.use("/api/doctor", require("./routes/doctor"));
app.use("/api/patient", require("./routes/patient"));
app.use("/api/appointment", require("./routes/appointment"));
app.use("/api/payment", require("./routes/payment"));

/* -------------------- Health -------------------- */
app.get("/health", (req, res) =>
  res.ok({ time: new Date().toISOString() }, "OK")
);

/* -------------------- Export for Vercel -------------------- */
module.exports = app;
