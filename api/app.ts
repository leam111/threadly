import "dotenv/config";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth";
import adminRoutes from "./routes/admin";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";

export const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);

// no route matched: answer with JSON, not the default HTML page
app.use((req: Request, res: Response) => {
  res.status(404).json({ message: "route not found" });
});

// 4 arguments tell Express this is the error handler
// keep the details in the server log, never in the answer
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
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
