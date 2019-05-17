// **** Token Implicit Grant (Browser) - UserLogin ****
//let redirectUri = 'https://szlaskidaniel.github.io/purecloud-send-sms/index.html';
let redirectUri = 'https://localhost/index.html';
const platformClient = require('platformClient');


var clientId = getUrlVars()["clientId"];
var environment = getUrlVars()["environment"];

// structure for TransferType
let transferType = {
    queue: 'queue',
    user: 'user'
};

var BUSY = 0;



const client = platformClient.ApiClient.instance
client.setPersistSettings(true);

function getUrlVars() {
    var vars = [], hash;
    var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
    for (var i = 0; i < hashes.length; i++) {
        hash = hashes[i].split('=');
        vars.push(hash[0]);
        vars[hash[0]] = hash[1];
    }
    return vars;
}

// Save clientId & env to Cookies
/*
if (clientId && environment) {
    Cookies.set('clientId', clientId, { "expires": 2 });
    Cookies.set('environment', environment, { "expires": 2 });
} else {
    console.log('clientId & env retrieved from Cookie storage');
    clientId = Cookies.get('clientId');
    environment = Cookies.get('environment');
}
*/

// Set Environment (in case page reloaded)
client.setEnvironment(environment);

let apiUsers = new platformClient.UsersApi();
let apiNotification = new platformClient.NotificationsApi();
let apiConversations = new platformClient.ConversationsApi();
let apiRouting = new platformClient.RoutingApi();
let apiToken = new platformClient.TokensApi();

var QUEUES = [];
var USERS = [];


init();

function init() {
    client.loginImplicitGrant(clientId, redirectUri)
        .then(() => {
            console.log('user authenticated');
            getQueues();
            getUsers();

            getMe().then(function (getMeResponse) {
                console.log('userId', getMeResponse.userId);
                $("#orgDetails").text(`${getMeResponse.orgName}`);

                createNotificationChannel().then(function (resp) {
                    console.log(`channelId created ${resp.channelId}`);
                    subscribeForTopic(resp.channelId, getMeResponse.userId).then(function () {
                        console.log(`subscribed successfully`);
                        createWebSocket(resp.connectUri, getMeResponse.userId).then(function (resp) {

                        })
                    }).catch(function (err) {

                    })

                }).catch(function (err) {

                })

            }).catch(function (err) {

            })

        })
        .catch((err) => {
            // Handle failure response
            console.log(err);
        });

}




//#endregion

function getMe() {
    console.log('getMe');
    return new Promise(function (resolve, reject) {
        try {
            apiUsers.getUsersMe({ "expand": ["organization"] })
                .then((data) => {
                    //console.log(`getUsersMe success! data: ${JSON.stringify(data, null, 2)}`);
                    console.log('getUsersMe success!');
                    let ret = {
                        "userId": data.id,
                        "userName": data.name,
                        "orgName": data.organization.name
                    }
                    resolve(ret);
                })
                .catch((err) => {
                    console.log('There was a failure calling getUsersMe');
                    console.error(err);
                    reject(err);
                });
        } catch (error) {
            console.error(error);
            reject(error);
        }
    });
}

function createNotificationChannel() {
    console.log('createNotificationChannel');
    return new Promise(function (resolve, reject) {
        apiNotification.postNotificationsChannels()
            .then((data) => {
                console.log(`postNotificationsChannels success! data: ${JSON.stringify(data, null, 2)}`);
                let resp = {
                    "channelId": data.id,
                    "connectUri": data.connectUri
                }
                resolve(resp);

            })
            .catch((err) => {
                console.log('There was a failure calling postNotificationsChannels');
                console.error(err);
                reject(err);
            });
    });
}


function subscribeForTopic(channelId, userId) {
    console.log('subscribeForTopic');
    return new Promise(function (resolve, reject) {

        let body = [{
            "id": `v2.users.${userId}.conversations`
        }];

        apiNotification.postNotificationsChannelSubscriptions(channelId, body)
            .then((data) => {
                console.log(`putNotificationsChannelSubscriptions success! data: ${JSON.stringify(data, null, 2)}`);
                resolve();
            })
            .catch((err) => {
                console.log('There was a failure calling putNotificationsChannelSubscriptions');
                console.error(err);
                resolve(err);
            });
    });
}

function getActiveConversation() {
    console.log('getActiveConversation');
    return new Promise(function (resolve, reject) {
        apiConversations.getConversations()
            .then((data) => {
                //console.log(`getConversations success! data: ${JSON.stringify(data, null, 2)}`);
                console.log('#### analyze start');
                try {

                    var interactionId;
                    var lastParitcipant;

                    var arrNotHold = [];


                    for (var aItem in data.entities) {
                        lastParitcipant = data.entities[aItem].participants[data.entities[aItem].participants.length - 1];

                        if (lastParitcipant.purpose != 'agent') {
                            console.log('interaction is not assigned to the current Agent.');
                            continue;
                        }

                        if (lastParitcipant["chats"] && !lastParitcipant["chats"][0].held && lastParitcipant["chats"][0].state == 'connected') {
                            console.log(`${data.entities[aItem].id} -> chat -> isHeld? ${lastParitcipant["chats"][0].held}`);
                            interactionId = data.entities[aItem].id;
                            arrNotHold.push({
                                "type": "chat",
                                "interactionId": interactionId,
                                "participantId": lastParitcipant.id
                            })
                            continue;

                        } else if (lastParitcipant["emails"] && !lastParitcipant["emails"][0].held && lastParitcipant["emails"][0].state == 'connected') {
                            console.log(`${data.entities[aItem].id} -> mail -> isHeld? ${lastParitcipant["emails"][0].held}`);
                            interactionId = data.entities[aItem].id;
                            arrNotHold.push({
                                "type": "mail",
                                "interactionId": interactionId,
                                "participantId": lastParitcipant.id
                            })
                            continue;

                        } else if (lastParitcipant["calls"] && !lastParitcipant["calls"][0].held && lastParitcipant["calls"][0].state == 'connected') {
                            console.log(`${data.entities[aItem].id} -> call -> isHeld? ${lastParitcipant["calls"][0].held}`);
                            interactionId = data.entities[aItem].id;
                            arrNotHold.push({
                                "type": "call",
                                "interactionId": interactionId,
                                "participantId": lastParitcipant.id
                            })
                            continue;
                        }
                    }
                    
                    if (arrNotHold.length > 1) {
                        var currentElement = 0
                        for (aItem in arrNotHold) {
                            if (arrNotHold[aItem].type == 'call') {
                                currentElement = aItem;
                                continue;
                            } else {
                                currentElement = aItem;
                                break;
                            }
                        }
                        console.log('valid element is at index ' + currentElement);
                        console.log(arrNotHold[currentElement]);
                        console.log(arrNotHold[currentElement].interactionId);
                        resolve({
                            "interactionId": arrNotHold[currentElement].interactionId,
                            "participantId": arrNotHold[currentElement].participantId
                        });
                    } else if (arrNotHold.length == 1) {
                        resolve({
                            "interactionId": arrNotHold[0].interactionId,
                            "participantId": arrNotHold[0].participantId
                        });
                    } else {
                        resolve();
                    }


                    console.log('#### analyze end');
                    /*
                    let resp = {
                        "interactionId": interactionId,
                        "participantId": lastParitcipant.id
                    }
                    console.log(resp);
                    resolve(resp);
                    */

                } catch (error) {
                    console.error(error);
                    reject(error);
                }

            })
            .catch((err) => {
                console.log('There was a failure calling getConversations');
                console.error(err);
                reject();
            });
    });
}

function createWebSocket(_webSocketUri, _userId) {
    console.log(`createWebSocket for userId: ${_userId}`);
    try {
        let webSocket = new WebSocket(_webSocketUri);

        webSocket.onopen = function (event) {
            console.log(`webSocket opened`);
        };

        webSocket.onmessage = function (event) {
            console.log(BUSY);
            if (BUSY == 1) {
                console.log('busy');
                return;
            }
            BUSY = 1;

            var data = JSON.parse(event.data);

            console.log(data);

            // we do not care about channel.metadata informations. Ignore them

            if (data.topicName == 'channel.metadata') {
                BUSY = 0;
                return;
            }

            try {
                console.log('new event from webSocket -> getActiveConversation');

                getActiveConversation().then(function (resp) {

                    console.log('RESPONSE');
                    console.log(resp);

                    if (resp && resp.interactionId) {
                        console.log(`Active conversationId is ${resp.interactionId}`);
                        $("#conversationId").text(resp.interactionId);
                        $("#participantId").text(resp.participantId);
                        BUSY = 0;

                    } else {
                        console.log('selected interaction is not valid');
                        $("#conversationId").text('n/a');
                        $("#participantId").text('n/a');
                        BUSY = 0;
                    }

                }).catch(function (err) {
                    console.error(err);
                    BUSY = 0;
                })


            } catch (error) {
                console.log(error);
                BUSY = 0;
            }
        }

        webSocket.onerror = function (error) {
            console.error(error);
        }

    } catch (error) {
        console.error(error);
    }
}



function postConversationsMessages(queueId, phoneNumber) {
    console.log('postConversationsMessages');
    return new Promise(function (resolve, reject) {
        try {
            let body = {
                "queueId": queueId,
                "toAddress": phoneNumber,
                "toAddressMessengerType": 'sms',
                "useExistingConversation": true
            }

            apiInstance.postConversationsMessages(body)
                .then((data) => {
                    console.log(`postConversationsMessages success! data: ${JSON.stringify(data, null, 2)}`);
                    resolve(data.id)
                })
                .catch((err) => {
                    console.log('There was a failure calling postConversationsMessages');
                    console.error(err);
                    reject(err);
                });
        } catch (err) {
            console.log(err);
            reject();
        }
    });
}

function transfer(conversationId, participantId, objectId, aTransferType) {
    console.log(`${aTransferType} transfer to ${objectId}`);
    return new Promise(function (resolve, reject) {
        try {
            var body;
            if (aTransferType == transferType.queue) {
                body = {
                    "queueId": QUEUES[objectId]
                }
            } else {
                body = {
                    "userId": USERS[objectId]
                }
            }

            /*
            let body_example = {
                "userId": String,
                "address": String,
                "userName": String,
                "queueId": String,
                "voicemail": Boolean,
            }
            */

            console.log(`conversationId: ${conversationId}`);
            console.log(`participantId: ${participantId}`);

            apiConversations.postConversationsCallParticipantReplace(conversationId, participantId, body)
                .then(() => {
                    console.log('postConversationsCallParticipantReplace returned successfully.');
                    resolve();
                })
                .catch((err) => {
                    console.log('There was a failure calling postConversationsCallParticipantReplace');
                    console.error(err);
                    reject(err.body.message);
                });
        } catch (error) {
            console.error(error);
            reject(error);
        }

    });
}


//TODO: Make it multipages. This works only for first 50 Queues!
function getQueues() {
    console.log('getQueues');
    return new Promise(function (resolve, reject) {
        try {
            let opts = {
                'pageSize': 50,
                'pageNumber': 1,
                'sortBy': "name",
                'active': true
            };

            apiRouting.getRoutingQueues(opts)
                .then((data) => {
                    for (aQueue in data.entities) {
                        QUEUES[data.entities[aQueue].name] = data.entities[aQueue].id
                    }

                    // Update Button Transfer1
                    var sString = "";
                    for (aItem in QUEUES) {
                        sString = `${sString}<a class="dropdown-item" href="#">${aItem}</a>`
                    }
                    $('div#transfer1.dropdown-menu').html(sString);
                    $('div#transfer2.dropdown-menu').html(sString);
                    $('div#transfer3.dropdown-menu').html(sString);



                    // Add Action to update text & save in Cookies
                    $('.dropdown-menu a').click(function (me) {
                        console.log(me.currentTarget.parentElement.id);
                        console.log(me.currentTarget.innerText);
                        $(`#btnTransfer-${me.currentTarget.parentElement.id}`).text(me.currentTarget.innerText);
                        Cookies.set(`#btnTransfer-${me.currentTarget.parentElement.id}`, me.currentTarget.innerText, { expires: 3650 });

                    });



                })
                .catch((err) => {
                    console.log('There was a failure calling getRoutingQueues');
                    console.error(err);
                });
        } catch (error) {
            console.error(error);
            reject(error);
        }

    });
}


//TODO: Make it multipages. This works only for first 50 Queues!
function getUsers() {
    console.log('getUsers');
    return new Promise(function (resolve, reject) {
        try {
            let opts = {
                'pageSize': 50,
                'pageNumber': 1,
                'sortBy': "name",
                'active': true
            };

            apiUsers.getUsers(opts)
                .then((data) => {
                    for (aUser in data.entities) {
                        USERS[data.entities[aUser].name] = data.entities[aUser].id
                    }
                    console.log(USERS);

                    // Update Button TransferUser1
                    var sString = "";
                    for (aItem in USERS) {
                        sString = `${sString}<a class="dropdown-item" href="#">${aItem}</a>`
                    }
                    $('div#transferUser1.dropdown-menu').html(sString);



                })
                .catch((err) => {
                    console.log('There was a failure calling getUsers');
                    console.error(err);
                });
        } catch (error) {
            console.error(error);
            reject(error);
        }

    });
}


function deleteTokenforUserId() {
    console.log(`deleteTokenforUserId`);
    try {
        apiToken.deleteTokensMe()
            .then(() => {
                console.log('deleteToken returned successfully.');
                init();

            })
            .catch((err) => {
                console.log('There was a failure calling deleteToken');
                console.error(err);
            });
    } catch (error) {
        console.error(error);
    }
}