/*
* Services used by both requester & lab
*
* */

angular.module("pocApp")

    .service('commonSvc', function($q,$http) {

        return {

            makeQR : function (Q,formData) {
                //construct a QR
                let QR = {resourceType:"QuestionnaireResponse",questionnaire:Q.url,status:'completed',item:[]}



                Q.item.forEach(function (sectionItem) {
                    let sectionRootItem = null
                    sectionItem.item.forEach(function (childItem) {
                        //todo - add group level activity - check for childItem.item and iterate through the grand children
                        if (formData[childItem.linkId]) {
                            //create the answerItem
                            let answerItem = {linkId:childItem.linkId,text:childItem.text,answer:[]}
                            answerItem.answer.push({valueString:formData[childItem.linkId]})
                            //have we created the sectionitem yet?
                            if (! sectionRootItem) {
                                //this is the first child entry that has data
                                sectionRootItem = {linkId:sectionItem.linkId,text:sectionItem.text,item:[]}     //create the section answer
                                sectionRootItem.item.push(answerItem)  //add the actual answer
                                QR.item.push(sectionRootItem)   //add the section to the root..

                            } else {
                                sectionRootItem.item.push(answerItem)
                            }
                        }
                    })

                })


                return QR






            },

            getPatientName : function(patient) {
                let name = ""
                if (patient.name) {
                    //todo look for firstName, lastName etc.
                    name = patient.name[0].text
                }
                return name
            },
            parseQ : function(Q) {
                //parse a Q into a simple display structure - sections holding questions. 2 level only.

                let arSections = []
                Q.item.forEach(function (sectionItem) {
                    let section = {text:sectionItem.text,questions:[]}
                    arSections.push(section)
                    sectionItem.item.forEach(function (questionItem) {
                        let question = {text:questionItem.text,type:questionItem.type,linkId:questionItem.linkId}
                        section.questions.push(question)

                    })
                })
                return arSections

            },
            makePOSTEntry :function (resource) {
                //Make a create entry. Assume the resource has an id that is a UUID
                let entry = {}
                entry.fullUrl = "urn:uuid:"+ resource.id
                entry.resource = resource
                entry.request = {method:"POST",url:"urn:uuid:"+ resource.id}
                return entry


            },
            createUUID : function() {

                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
            }

        }
    }
)