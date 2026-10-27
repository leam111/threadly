import "dotenv/config";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth";
import adminRoutes from "./routes/admin";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import wardrobeRoutes from "./routes/wardrobe";
import profileRoutes from "./routes/profile";
import docsRoutes from "./routes/docs";
import { AppError } from "./utils/appError";
export const app = express();

// the Swagger page (/docs) is for development only: never served in production
const showDocs = process.env.NODE_ENV !== "production";

// the normal, strict security headers for every route
const strictHeaders = helmet();
// the Swagger page only: the same, but without "upgrade-insecure-requests",
// which would make the browser ask for the page's files over https on http://localhost
const docsHeaders = helmet({
  contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } },
});

app.use((req: Request, res: Response, next: NextFunction) => {
  const isDocsPage = req.path === "/docs" || req.path.startsWith("/docs/");
  if (showDocs && isDocsPage) {
    docsHeaders(req, res, next);
    return;
  }
  strictHeaders(req, res, next);
});
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);

app.use("/wardrobe", wardrobeRoutes);
app.use("/profile", profileRoutes);

if (showDocs) {
  app.use(docsRoutes);
}

// no route matched: answer with JSON, not the default HTML page
app.use((req: Request, res: Response) => {
  res.status(404).json({ message: "route not found" });
});

// 4 arguments tell Express this is the error handler
// keep the details in the server log, never in the answer
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  // a refusal from a service: its status and message were chosen on purpose
  if (err instanceof AppError) {
    res.status(err.status).json({ message: err.message });
    return;
  }

  const status =
    typeof err === "object" && err !== null && "status" in err && typeof err.status === "number"
      ? err.status
      : 500;

  // a client mistake like broken JSON keeps its 4xx code
  if (status >= 400 && status < 500) {
    res.status(status).json({ message: "bad request" });
    return;
  }

  console.error(err);
  res.status(500).json({ message: "something went wrong" });
});
