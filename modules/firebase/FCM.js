const admin = require("firebase-admin");
const {initializeApp} = require('firebase-admin/app');
const {getMessaging} = require('firebase-admin/messaging');
const { users } = require("../objects/users");

const firebaseApp = initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_CREDENTIAL))
}, 'miscsituet');
const messaging = getMessaging(firebaseApp);

async function FCMNotify({title , body, user_ids}) {
    return new Promise((resolve,reject) => {
        // console.log('[firebase/FCM.FCMNotify] called')
    
        const fcm_tokens = user_ids.reduce((arr, user_id)=> arr.concat(users[user_id]?.fcm_tokens?.map(o => o.token)),[]).filter(o => o != undefined)
        if (fcm_tokens.length == 0) return reject({code: 4000, message: 'No tokens to notify'})
    
        messaging.sendEachForMulticast({
            tokens: fcm_tokens,
            notification: {
                title: title,
                body: body
            },
        }).then((res) => {
            console.log('[firebase/FCM] Sent push notification; response = ',JSON.stringify(res));
            return resolve()
            // res.responses.forEach((response,index) => {
            //     if (response.error) removeUserToken(fcm_tokens[index])
            // })
        }).catch((error) => {
            return reject(error)
        });
    })
}

module.exports = {
    FCMNotify
}