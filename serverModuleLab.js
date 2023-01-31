
const axios = require("axios");
const config = require("./config.json")
const showLog = true
let db

//import { MongoClient } from "mongodb";
let MongoClient = require('mongodb').MongoClient;

const uri = "mongodb://127.0.0.1:27017";
const client = new MongoClient(uri);
const database = client.db("labDataStore")

//set the database, source server and backup API points
function setup(app,inDb) {

    db = inDb

    //load the ServiceRequests
    app.get('/lab/activeSR', function(req,res){
        let query = { status: "active"}

        database.collection("labSR").find(query).toArray(function(err,doc){
            if (err) {
                res.status(500);
                res.json({err:err});
            } else {
                res.json(doc)
            }
        })

    })


    //receive a SR
    //todo - needs better error checking.
    app.post('/lab/ServiceRequest', async function(req,res){
        if (showLog) {
            console.log("/lab/ServiceRequest invoked")
        }

        let sr = req.body
        let identifierQuery = sr.identifier[0].system + "|" + sr.identifier[0].value
        //the received SR is a minimal one - need to retrieve the full version from the Server based on the identifier
        try {
            let qry = config.canShare.fhirServer.url + "/ServiceRequest?identifier=" + identifierQuery
            let response = await axios.get(qry)
            let bundle = response.data
            let SR = getFirstResourceFromBundle(bundle)

            //we're going to save the resources in an array in the mongodb (representing the local datastore)
            let resources = {resources:[SR]}

            //now retrieve all the supporting resources using a transaction search. This would be unnessecary with a custom searchparameter
            let bundleRequest = {resourceType:"Bundle","type":"collection",entry:[]}

            //first, create the batch request bundle
            let batchRequest = {resourceType:"Bundle",type:"batch",entry:[]}
            if (SR.supportingInfo) {
                SR.supportingInfo.forEach(function (ref) {
                    let entry = {request:{method:"GET",url:ref.reference}}
                    batchRequest.entry.push(entry)
                })
            }

            //now execute it. Will return a bundle of matching resources
            if (batchRequest.entry.length > 0) {
                let qry = `${config.canShare.fhirServer.url}/`
                let response = await axios.post(qry,batchRequest)
                let bundle = response.data
                if (bundle && bundle.entry &&  bundle.entry.length > 0) {
                    bundle.entry.forEach(function(entry){
                        resources.resources.push(entry.resource)
                    })
                }
            }

            //finally, we can save the set of resources in the local mongo db
            database.collection("labRequests").insertOne(resources, function (err, result) {
                if (err) {
                    console.log('Error saving request resources ',err)
                    res.status(500).json()
                } else {
                    res.json()
                }
            });

        } catch (ex) {
            console.log('error',ex)
        }




        //console.log("ServiceRequest",sr)



    })

}

//retrieve the first respource in the bundle.
//todo - this is something to consider - do we require conditional create from the requester
function getFirstResourceFromBundle(bundle) {
    let resource
    if (bundle && bundle.entry && bundle.entry.length > 0) {
        resource = bundle.entry[0].resource
    }
    return resource
}

module.exports = {
    setup : setup
};