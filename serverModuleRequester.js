//endpoints used by the requester component

const axios = require("axios");
const config = require("./config.json")
const showLog = true
let db
//set the database, source server and backup API points
function setup(app,inDb) {

    db = inDb

    //the request templates
    app.get('/requester/templates',async function(req,res){

        let qry = config.canShare.fhirServer.url + "/Questionnaire?context=request"
        try {
            let response = await axios.get(qry)
            let bundle = response.data
            res.json(bundle)
        } catch (ex) {
            res.status(500).json(ex)
        }



    })


    //send a request from the requester UI to the IE. Assume that this is a bundle, so just send it
    app.post('/requester/makerequest', async function(req,res){
        if (showLog) {
            console.log("/requester/makerequest invoked")
        }
        let body = req.body
         //console.log("body",body)
        let url = config.canShare.requestEndPoint.url
        try {
            let response = await axios.post(url,body)

            res.send(response.data)
        } catch (err) {
            //the server (node red) returned an error status code.

            if (err.response) {
                //console.log('resp')
                res.status(err.response.status).send(err.response.data)
            } else {
                res.status(400).send(err)
            }
        }



    })

    //retrieve forms templates
    app.get('/requester/templates', async function(req,res){
        res.json()

    })

}



module.exports = {
    setup : setup
};