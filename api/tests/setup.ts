import "dotenv/config";
import mongoose from "mongoose";

beforeAll(async()=>{

const uri = process.env.MONGODB_URI_TEST;



if(!uri){
    throw new Error('MONGODB_URI_TEST is missing in .env');
}
if (!uri.includes("_test")) {
  throw new Error("MONGODB_URI_TEST must point to a database whose name contains _test");
}
await mongoose.connect(uri);


});

afterAll (async()=>{

await mongoose.disconnect();

})