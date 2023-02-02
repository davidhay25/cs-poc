let fs = require('fs')
let http = require('http');

let port = 9100

const bodyParser = require('body-parser')

const requesterModule = require("./serverModuleRequester.js")
const labModule = require("./serverModuleLab.js")


let config = require("./config.json")

let express = require('express');
let app = express();
app.use(bodyParser.json({limit:'50mb',type:['application/fhir+json','application/json']}))

requesterModule.setup(app)
labModule.setup(app)



//let MongoClient = require('mongodb').MongoClient;
/*
MongoClient.connect('mongodb://127.0.0.1:27017/clinfhir', function(err, ldb) {
    if(err) {
        console.log('>>> Mongo server not running. Routes will NOT work correctly.')
    } else {
        db = ldb;

        requesterModule.setup(app,ldb)
        labModule.setup(app,ldb)
        console.log("Init complete.")

    }
});

*/

//common calls (not specifically related to requester or lab. ?move to separate module
app.get('/config', async function(req,res){
    res.json(config)
})


server = http.createServer(app).listen(port);
console.log("Server listening on port " + port)

//the default page
app.use('/', express.static(__dirname,{index:'/monitor.html'}));
