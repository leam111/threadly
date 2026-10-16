import "dotenv/config"
import { connectDB } from "./db";
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import express from "express";
const app = express();

app.use(express.json());



app.use("/auth",authRoutes);
app.use("/admin",adminRoutes);









async function start() {
  await connectDB();
  app.listen(3000, () => {
    console.log("server is running on port 3000");
  });
}
start();