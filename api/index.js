const express = require("express");
const app = express();


app.get("/lilo",(req,res)=>{
res.send("hello threadlyyy!!!")

})

app.listen(3000,()=>{
    console.log("server is running on port 3000")
});