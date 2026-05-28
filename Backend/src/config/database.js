const dns = require("dns");
dns.setServers(["8.8.8.8","8.8.4.4"]);

const mongoose = require('mongoose');

async function connectDB(){
    try{
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB sucessfully");
    }
    catch(err){
        console.log(err)
    }

}
module.exports = connectDB