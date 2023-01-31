angular.module("pocApp")
    .controller('requesterCtrl',
        function ($scope,$http) {

            $scope.input = {};

            //order is important as SR has a reference to QR
            $scope.patient = makePatient()
            $scope.qr = makeQR();
            $scope.sr = makeSR()
            $scope.bundle = makeBundle()

            //send the request through to canshare (via the IE)
            $scope.sendRequest = function(){
                let bundle = makeBundle();
                //let bundle = {"resourceType":"Bundle",type:'transaction',entry:[]}
               // bundle.identifier = {system:"http://canshare.co.nz/identifier/bundle",value:new Date().toISOString()}
                //addEntry(bundle,$scope.qr)
                //addEntry(bundle,$scope.sr)
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
                addEntry(bundle,$scope.patient)
                addEntry(bundle,$scope.qr)
                addEntry(bundle,$scope.sr)
                return bundle
            }

            //add the resource as an entry to the bundle. Assume id is a UUID
            function addEntry(bundle,resource) {
                let entry = {fullUrl:`urn:uuid:${resource.id}`,resource:resource,request:{}}
                entry.request.method = "POST"
                entry.request.url = resource.resourceType
                bundle.entry.push(entry)

            }



            function makePatient() {
                let patient = {resourceType:"Patient",id:createUUID(),name:[{text:"John Doe"}]}
                return patient
            }


            function makeQR() {
                let qr = {resourceType:"QuestionnaireResponse",id:createUUID(),status:"completed",item:[]}
                qr.subject = {reference:`urn:uuid:${$scope.patient.id}`}
                qr.item.push({"linkId":"hx",answer:[{valueString:"Noted breast lump R) breast"}] })
                qr.item.push({"linkId":"pmh",answer:[{valueString:"Nil of note"}] })
                qr.item.push({"linkId":"find",answer:[{valueString:"Lump R) breast 3 o'clock 3cm from nipple"}] })
                return qr
            }

            function makeSR() {
                let sr = {resourceType:"ServiceRequest",id:createUUID(),status:"active",intent:"order"}
                sr.subject = {reference:`urn:uuid:${$scope.patient.id}`}
                sr.identifier = [{system:"http://canshare.co.nz/identifier",value: new Date().toISOString()}]
                sr.supportingInfo = [{reference:"urn:uuid:"+$scope.qr.id}]
                return sr
            }

            function createUUID() {
                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
            }
        })