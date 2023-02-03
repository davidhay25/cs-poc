angular.module("pocApp")
    .controller('labCtrl',
        function ($scope,$http,commonSvc) {

            $scope.input = {};
            $scope.answer = {};     //the answers. keyed by linkId.

            //load the config. We need this for the fullUrl in the bundle for the SR
            $http.get("/config").then(
                function(data) {
                    $scope.config = data.data
                }

            )

            //load the list of possible report templates (questionnaires)
            $http.get("/lab/templates").then(
                function(data) {
                    //returns a bundle in data.data
                    //copy into a simpler structure for ease of handling
                    $scope.templates = []
                    data.data.entry.forEach(function (entry) {
                        $scope.templates.push({display:entry.resource.title,Q:entry.resource})
                    })

                }, function(err) {
                    console.log(err)
                }
            )

            //this goes to the local supporting module which queries the data store. The assumption is that this
            //was populated when the lab system received the 'notification' SR from the CS server
            //the contents will be FHIR resources, but the FHI is a bespoke one.
            function getActiveReqests() {
                $http.get("/lab/activeSR").then(
                    function(data) {
                        $scope.activeRequests = data.data   // {SR:{}, QR: Pat: others:[]

                        //construct a simple array of objects to display in the UI
                        data.data.forEach(function (request) {

                        })


                    }, function (err) {
                        console.log(err)
                    }
                )
            }

            //retrieve all the active SRs
            getActiveReqests()

            //select the report template. This is used to generate the UI and report.
            //Note that unlike the requester, a QR is not genereated - it's a DR / Observations combo. Of course
            //if a commercial Q based forms app were to be used, then a QR would be generated. The lab would then need
            //to create the DR/Obs from the QR.
            $scope.selectQ = function(template) {
                $scope.selectedQ = template.Q
                let formTemplate = commonSvc.parseQ(template.Q)     //the actual data source for the rendered form
                console.log(formTemplate)
                $scope.selectedForm = formTemplate

                //now create the relationship between the item.code and linkId in the Q. This is needed
                //as the Observations that will be generated will use the code from the item...
                //This code is simple, and assumes that the Q has 2 level structure of Sections / items. It will need to be
                //revised when groups are supported...

                $scope.hashLinkIdCodes = {}
                $scope.selectedQ.item.forEach(function (sectionItem) {
                    sectionItem.item.forEach(function (item) {
                        //This is an array of Coding. We only want the first one...
                        $scope.hashLinkIdCodes[item.linkId] = item.code[0]         //note this is a Coding dt

                    })
                })
                console.log($scope.hashLinkIdCodes)
            }

            $scope.selectRequest = function(request) {
                $scope.selectedRequest = request
                $scope.selectedQR = request.QR



            }

            //create a set of DR / Obs and send to the CS Server
            $scope.submitReport = function() {
                //assume that the Patient resource (from the CS server). For now, we won't include the Patient resource - could potentially add the identifier to the reference as well, not sure why...
                //in the bundle, but will include a reference and NHI from all the resources
                //assume that there is only a single answer per item - no multiples...

                if (! confirm("Are you sure you wish to submit this report")) {
                    return
                }

                //All

                let bundle = {resourceType:"Bundle",entry:[]}
                let DR = {resourceType:"DiagnosticReport",id:commonSvc.createUUID(), status:"final",result:[]}
                DR.identifier = [commonSvc.createUUIDIdentifier()]
                DR.basedOn = {reference:'ServiceRequest/'+ $scope.selectedRequest.SR.id}
                DR.subject = {reference:'Patient/' + $scope.selectedRequest.Pat.id}
                DR.basedOn = {reference: `ServiceRequest/${$scope.selectedRequest.SR.id}`}
                DR.performer = [{display:"Pertinent Pathology"}]
                DR.issued = new Date().toISOString()
                DR.code = {text:"Histology report"}

                Object.keys($scope.answer).forEach(function (key) {
                    let issuedDate = new Date().toISOString()
                    let value = $scope.answer[key]
                    if (value) {
                        let obs = {"resourceType":"Observation",id:commonSvc.createUUID(),status:"final"}
                        obs.identifier = [commonSvc.createUUIDIdentifier()]
                        obs.subject = {reference:'Patient/' + $scope.selectedRequest.Pat.id}
                        obs.performer = [{text:"Pertinent Pathology"}]
                        obs.basedOn = {reference:'ServiceRequest/'+ $scope.selectedRequest.SR.id}
                        //the code is defined in the Q item (along with the linkId which is the key)
                        obs.code =  {coding:[$scope.hashLinkIdCodes[key]]}

                        obs.effectiveDateTime = issuedDate
                        obs.issued = issuedDate
                        obs.valueString = value
                        DR.result.push({reference:"urn:uuid:"+ obs.id})
                        bundle.entry.push(commonSvc.makePOSTEntry(obs))
                    }
                })
                bundle.entry.push(commonSvc.makePOSTEntry(DR))

                //also need to update and add the SR to the bundle.
                //it should be safe to use the one we retrieved first time as no one else should have updated it
                $scope.selectedRequest.SR.status = "completed"

                //add to the bundle - note that it's a PUT, and it has a real id (the one on the CS server)
                //todo - should this be a conditional update
                let entry = {resource:$scope.selectedRequest.SR}
                entry.fullUrl = $scope.config.canShare.fhirServer.url + "/ServiceRequest/"+ $scope.selectedRequest.SR.id
                entry.request = {method:"PUT",url:"ServiceRequest/"+$scope.selectedRequest.SR.id}
                bundle.entry.push(entry)

                console.log(bundle)

                //finally, we can send the report to the CS Server. We actually need to do 2 things:
                // - send the bundle
                // - update the localDb to indicate that the SR has been completed.
                // we'll do this in a local server script

                $http.post("/lab/submitreport",bundle).then(
                    function(data){
                        alert("Report has been submitted")
                        console.log(data)
                    }, function(err) {
                        console.log(err)
                        alert("There was an error: " + angular.toJson(err.data))
                    }
                )

            }

            //return a patient name from the Patient resource
            $scope.getPatientName = function(patient) {
                let name = ""
                if (patient.name) {
                    //todo look for firstName, lastName etc.
                    name = patient.name[0].text
                }
                return name
            }


        })