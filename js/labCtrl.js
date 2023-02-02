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

            $scope.selectQ = function(template) {
                $scope.selectedQ = template.Q
                let formTemplate = commonSvc.parseQ(template.Q)     //the actual data source for the rendered form
                console.log(formTemplate)
                $scope.selectedForm = formTemplate

                //now create the relationship between the item.code and linkId in the Q. This is needed
                //as the Observations that will be generated will use the code from the item...
                //This code is simle, and assumes that the Q has 2 level structure of Sections / items. It will need to be
                //revised if that changes...

                $scope.hashLinkIdCodes = {}
                $scope.selectedQ.item.forEach(function (sectionItem) {
                    sectionItem.item.forEach(function (item) {
                        $scope.hashLinkIdCodes[item.linkId] = item.code         //note this is a Coding dt

                    })
                })
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

                //All

                let bundle = {resourceType:"Bundle",entry:[]}
                let DR = {resourceType:"DiagnosticReport",id:commonSvc.createUUID(), status:"final",result:[]}
                DR.subject = {reference:'Patient/' + $scope.selectedRequest.Pat.id}


                Object.keys($scope.answer).forEach(function (key) {
                    let value = $scope.answer[key]
                    if (value) {
                        let obs = {"resourceType":"Observation",id:commonSvc.createUUID(),status:"final"}
                        obs.subject = {reference:'Patient/' + $scope.selectedRequest.Pat.id}
                        //the code is defined in the Q item (along with the linkId which is the key)
                        obs.code =  $scope.hashLinkIdCodes[key]
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
                        console.log(data)
                    }, function(err) {
                        console.log(err)
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