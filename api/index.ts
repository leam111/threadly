import "dotenv/config"
import helmet from "helmet";
import { connectDB } from "./db";
import cookieParser from "cookie-parser";
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import express from "express";
import cors from "cors";


const app = express();
 app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
  credentials: true,
}));



app.use(express.json());
app.use(cookieParser());

app.use("/auth",authRoutes);
app.use("/admin",adminRoutes);









async function start() {
  await connectDB();
  app.listen(3000, () => {
    console.log("server is running on port 3000");
  });
}
start();