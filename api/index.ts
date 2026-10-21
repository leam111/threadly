import "dotenv/config";
import { connectDB } from "./db";
import { app } from "./app";

async function start() {
  await connectDB();
  app.listen(3000, () => {
    console.log("server is running on port 3000");
  });
}

start();