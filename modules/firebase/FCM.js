const admin = require("firebase-admin");
const {initializeApp} = require('firebase-admin/app');
const {getMessaging} = require('firebase-admin/messaging');
const { users } = require("../objects/users");

const firebaseApp = initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_CREDENTIAL))
}, 'miscsituet');
const messaging = getMessaging(firebaseApp);

function FCMNotify({title , body, user_ids}) {
    // console.log('[firebase/FCM.FCMNotify] called')
    const fcm_tokens = user_ids.reduce((arr, user_id)=> arr.concat(users[user_id]?.fcm_tokens?.map(o => o.token)),[]).filter(o => o != undefined)
    // console.log('[firebase/FCM.FCMNotify] tokens = ', fcm_tokens)
    // if (fcm_tokens.length == 0) return console.log('[firebase/FCM.FCMNotify] no tokens to notify')
    messaging.sendEachForMulticast({
        tokens: fcm_tokens,
        notification: {
            title: title,
            body: body
        },
    }).then((res) => {
        console.log('[firebase/FCM] Sent push notification; response = ',JSON.stringify(res));
        // res.responses.forEach((response,index) => {
        //     if (response.error) removeUserToken(fcm_tokens[index])
        // })
    }).catch((error) => {
        console.log('[firebase/FCM] Error sending notification:', error);
    });
}

module.exports = {
    FCMNotify
}