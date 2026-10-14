import express from "express";
const app = express();


app.get("/lilo",(req,res)=>{
res.send("hello threadlyyy again!!, this time using typescript ")

})

app.listen(3000,()=>{
    console.log("server is running on port 3000")
});