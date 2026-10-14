import "dotenv/config"
import { connectDB } from "./db";
import authRoutes from './routes/auth';

import express from "express";
const app = express();

app.use(express.json());



app.use("/auth",authRoutes);

app.get("/lilo",(req,res)=>{
res.send("hello threadlyyy again!!, this time using typescript ")

})

async function start() {
  await connectDB();

  app.listen(3000, () => {
    console.log("server is running on port 3000");
  });
}

start();