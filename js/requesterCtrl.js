angular.module("pocApp")
    .controller('requesterCtrl',
        function ($scope,$http,commonSvc) {

            $scope.input = {};
            $scope.commonSvc = commonSvc
            $scope.answer = {}      //will have the form data

            //load the config. We need this for the fullUrl in the request bundle and server interactions
            $http.get("/config").then(
                function(data) {
                    $scope.config = data.data

                    //load all the patients
                    let url = `${$scope.config.canShare.fhirServer.url}/Patient`
                    $http.get(url).then(
                        function (data) {
                            $scope.allPatients = data.data
                        }
                    )


                }

            )

            //load the list of possible report templates (questionnaires)
            $http.get("/requester/templates").then(
                function(data) {
                    //returns a bundle in data.data
                    //copy into a simpler structure for ease of handling
                    $scope.templates = []
                    data.data.entry.forEach(function (entry) {
                        $scope.templates.push({display:entry.resource.title,Q:entry.resource})
                    })

                    $scope.selectedTemplate = $scope.templates[0]
                    $scope.selectQ($scope.selectedTemplate)
                }, function(err) {
                    console.log(err)
                }
            )

            //this is emitted by the form template - formDisplay.html
            $scope.formUpdated = function () {

                $scope.QR = commonSvc.makeQR($scope.selectedQ,$scope.answer);
                $scope.QR.subject = {reference:`Patient/${$scope.selectedPatient.id}`}
                $scope.QR.identifier = [{system:"http://canshare.co.nz/identifier",value: new Date().toISOString()}]

                //todo this is only needed for the text display. Should it change?
                $scope.selectedQR = $scope.QR

                $scope.SR = makeSR()

                console.log($scope.QR)
                makeBundle()

            }



            $scope.selectPatient = function (patient) {
                //There really should be an NHI. Will remove this eventually.
                if (! patient.identifier) {
                    patient.identifier = [{system:"http://canshare.co.nz/identifier/bundle",value:new Date().toISOString()}]
                }
                $scope.selectedPatient = patient
            }

            //select the request form
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
/*
            //order is important as SR has a reference to QR
            $scope.patient = makePatient()
            $scope.qr = makeQR();
            $scope.sr = makeSR()
            $scope.bundle = makeBundle()
            */
            $scope.submitRequest = function () {
                if (confirm("Are you sure you wish to send this request?")) {

                    let bundle = makeBundle()   //should already have been done actually...
                    delete $scope.oo
                    let url = "/requester/makerequest"

                    $http.post(url,bundle).then(
                        function(data){
                            //console.log(data)
                            $scope.oo = data.data    //temp
                        }, function(err) {
                            //the response should be a OO explaining the error
                            $scope.oo = err.data
                            console.log(err)
                        }
                    )
                }

            }

            //send the request through to canshare (via the IE)
            $scope.sendRequestDEP = function(){
                let bundle = makeBundle();
                delete $scope.oo
                let url = "/requester/makerequest"

                $http.post(url,bundle).then(
                    function(data){
                        //console.log(data)
                        $scope.oo = data.data    //temp
                    }, function(err) {
                        //the response should be a OO explaining the error
                        $scope.oo = err.data
                        console.log(err)
                    }
                )
            }

            function makeBundle() {
                let bundle = {"resourceType":"Bundle",type:'transaction',entry:[]}
                bundle.identifier = {system:"http://canshare.co.nz/identifier/bundle",value:new Date().toISOString()}
                addEntry(bundle,$scope.selectedPatient)     //this will have the NHI as the identifer
                addEntry(bundle,$scope.QR)
                addEntry(bundle,$scope.SR)
                $scope.bundle = bundle
                return bundle
            }

            //add the resource as an entry to the bundle. Assume id is a UUID. Always conditional update.
            function addEntry(bundle,resource) {
                let entry = {fullUrl:`urn:uuid:${resource.id}`,resource:resource,request:{}}
                entry.request.method = "PUT"
                let identifierString = `${resource.identifier[0].system}|${resource.identifier[0].value}`
                entry.request.url = `${resource.resourceType}?identifier=${identifierString}`
                bundle.entry.push(entry)

            }



            function makePatientDEP() {
                let patient = {resourceType:"Patient",id:createUUID(),name:[{text:"John Doe"}]}
                return patient
            }


            function makeQRDEP() {
                let qr = {resourceType:"QuestionnaireResponse",id:createUUID(),status:"completed",item:[]}
                qr.subject = {reference:`urn:uuid:${$scope.selectedPatient.id}`}
                let itemHx = {linkId:"history",text:"History",item:[]}
                qr.item.push(itemHx)
                itemHx.item.push({"linkId":"hx",text:"History of Complaint", answer:[{valueString:"Noted breast lump R) breast"}] })
                itemHx.item.push({"linkId":"pmh",text:"Past Medical History", answer:[{valueString:"Nil of note"}] })
                let itemFinding = {linkId:"findings",text:"Findings",item:[]}
                qr.item.push(itemFinding)

                itemFinding.item.push({"linkId":"find",text:"Findings", answer:[{valueString:"Lump R) breast 3 o'clock 3cm from nipple"}] })
                return qr
            }

            function makeSR() {
                let sr = {resourceType:"ServiceRequest",id:createUUID(),status:"active",intent:"order"}
                sr.subject = {reference:`urn:uuid:${$scope.selectedPatient.id}`}
                sr.identifier = [{system:"http://canshare.co.nz/identifier",value: new Date().toISOString()}]
                sr.supportingInfo = [{reference:"urn:uuid:"+$scope.QR.id}]
                return sr
            }

            function createUUID() {
                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
            }
        })