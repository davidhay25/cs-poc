/*
*
* These are all endpoints that support the Lab application. They are generally not FHIR compliant.
* The only FHIR compliant one is the POST ServiceRequest which receives the SR 'notification' from the CS server
*
*/
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
function setup(app) {


    //receive a SR - FHIR compliant
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

            //todo check that SR not already in requests - that could be a duplicated notification

            //we're going to save the resources as a request object in the mongodb (representing the local datastore)
            // structire: {SR: Pat: QR: others:[]}
            let requestObj = {currentStatus:'active',srIdentifier:identifierQuery,SR:SR,others:[]}

            //now retrieve all the supporting resources using a transaction search. This would be unnessecary with a custom searchparameter
            //as we could retrieve them with using _include
            let bundleRequest = {resourceType:"Bundle","type":"collection",entry:[]}

            //first, create the batch request bundle
            let batchRequest = {resourceType:"Bundle",type:"batch",entry:[]}

            //now retrieve add the patient query to the search
            //todo should check that the subject is present
            //let patientId = SR.subject.reference
            batchRequest.entry.push({request:{method:"GET",url:SR.subject.reference}})

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

                        let resource = entry.resource
                        let type = resource.resourceType
                        switch (type) {
                            case "Patient" :
                                requestObj.Pat = resource
                                break
                            case "QuestionnaireResponse" :
                                requestObj.QR = resource
                                break
                            default :
                                requestObj.others.push(resource)
                                break
                        }
                        //requestObj.resources.push(entry.resource)
                    })
                }
            }

            //finally, we can save the set of resources in the local mongo db
            database.collection("labRequests").insertOne(requestObj, function (err, result) {
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

    //return the active ServiceRequests. not FHIR compliant (it's  local call used to display the SR's that are still outstanding)
    app.get('/lab/activeSR', function(req,res){
        let query = { currentStatus :  "active"}

        database.collection("labRequests").find(query).toArray(function(err,doc){
            if (err) {
                res.status(500);
                res.json({err:err});
            } else {
                console.log(doc)
                res.json(doc)
            }
        })

    })

    //post the report to the CS server (actually nodeRed) and update the local store plus save report.
    app.post("/lab/submitreport",async function(req,res){

        let bundle = req.body

        //get the SR from the bundle. Its id is in the reports
        let sr = getSRFromBundle(bundle)    //todo check not null

        let identifier = sr.identifier[0].system + "|" + sr.identifier[0].value
        //save the bundle to the local data store
        let createResult = database.collection("labReports").insertOne(bundle)  //todo should check the response

        //update local store (setting SR status to completed)
        let filter = {srIdentifier:identifier}
        let update = {$set:{currentStatus:"completed"}}
        let updateResult = await database.collection("labRequests").updateOne(filter, update);

        console.log(filter,update,updateResult)

        //send the bundle to the server
        let url = config.lab.reportEndpoint.url

        let submitResult = await axios.post(url,bundle)
        console.log(submitResult)


        //let r = await  database.collection("labRequests").find(filter).toArray()
        //console.log(r)
        /*

        let updateDoc = {$set:{"SR.status":"completed"}}
        let options = {}
        let updateResult = await database.collection("labRequests").updateOne(filter, updateDoc, options);
console.log(updateResult)
        //send the bundle to the server
        let url = config.lab.reportEndpoint.url
        let submitResult = await axios.post(url,bundle)


*/



    })

    //get the potential report templates (Q) that can be used.
    //It's a query to the Questionnaire endpoint of the canshare server specifying only report types (in useContext)
    //Futher refining of the request - eg filtering by tumour type - is possible.
    //the Q themselves are developed in the IG cs-datastandarddesigner
    app.get('/lab/templates',async function(req,res){

        let qry = config.canShare.fhirServer.url + "/Questionnaire?context=report"
        try {
            let response = await axios.get(qry)
            let bundle = response.data
            res.json(bundle)
        } catch (ex) {
            res.status(500).json(ex)
        }



    })

}

// ----------------- support ing functions -----------------

//retrieve the first respource in the bundle.
//todo - this is something to consider - do we require conditional create from the requester
function getFirstResourceFromBundle(bundle) {
    let resource
    if (bundle && bundle.entry && bundle.entry.length > 0) {
        resource = bundle.entry[0].resource
    }
    return resource
}

function getSRFromBundle(bundle) {
    let resource
    if (bundle && bundle.entry && bundle.entry.length > 0) {

        bundle.entry.forEach(function (entry) {
            if (entry.resource.resourceType == "ServiceRequest") {
                resource = entry.resource
            }
        })
        //resource = bundle.entry[0].resource
    }
    return resource
}


module.exports = {
    setup : setup
};