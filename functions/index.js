const functions = require('firebase-functions');

const admin = require('firebase-admin');
admin.initializeApp();

const VALID_APP_ID_CHARS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
for(let i = 65; i < 91; i++){
    VALID_APP_ID_CHARS.push(String.fromCharCode(i));
}
for(let i = 97; i < 123; i++){
    VALID_APP_ID_CHARS.push(String.fromCharCode(i));
}

console.log(admin.app.name);

// HTTPS endpoint
exports.addMessage = functions.https.onRequest((req, resp) => {
    const text = req.query.text;
    return admin.database().ref('/test/messages').push({text: text})
        .then((snapshot) => {
            return resp.redirect(303, snapshot.ref.toString());
        });
});

// on realtime database endpoint
exports.makeUppercase = functions.database.ref('/test/messages/{pushID}/text')
.onCreate((snapshot, context) => {
    const text = snapshot.val();
    console.log("Uppercasing", context.params.pushID, text);
    const uppercase = text.toUpperCase();
    return snapshot.ref.parent.child('uppercase').set(uppercase);
});

exports.uploadImages = functions.https.onRequest((req, resp) => {
    const [imageA_url, imageB_url] = req.body.image_urls;
    const creator_id = req.body.creator_id;
    const objA = createImageObj(imageA_url, creator_id);
    const objB = createImageObj(imageB_url, creator_id);
    const objA_id = admin.database().ref('/images').push(objA).key;
    const objB_id = admin.database().ref('/images').push(objB).key;
    const image_pair = createImagePair(objA_id, objB_id);
    return admin.database().ref('/image_pairs').push(image_pair)
        .then((snapshot) => {
            return resp.redirect(303, snapshot.ref.toString());
        });
});

function createImageObj(image_url, creator_id){
    return {
        image_url: image_url,
        upload_timestamp: new Date().getTime(),
        votes: [],
        creator_id: creator_id,
    };
}

function createImagePair(imageA_id, imageB_id){
    return {
        imageA: imageA_id,
        imageB: imageB_id,
    };
}

exports.getFeed = functions.https.onRequest((req, resp) => {
    const count = req.query.count || 5;
    const offset = 0;
    return admin.database().ref('/image_pairs').orderByKey()
        .startAt(offset).limitToFirst(count).once("value")
        .then((snapshot) => {
            // TODO: turn image_pairs to image links
            // const image_pairs = snapshot.ref.val();
            // for (const image_pair of image_pairs){}
            return resp.status(200).send({image_pairs: snapshot.ref.val()});
        })
});

exports.newUser = functions.https.onRequest((req, resp) => {
    let created_app_id = false;
    const app_id = []
    while(!created_app_id){
        for(let i = 0; i < 16; i++){
            app_id[i] = VALID_APP_ID_CHARS[Math.floor(
                Math.random() * VALID_APP_ID_CHARS.length)]
        }
        created_app_id = true;

        // https://gist.github.com/anantn/4323949
        // https://stackoverflow.com/questions/24824732/test-if-a-data-exist-in-firebase

        admin.database().ref('/app_ids').child(app_id)
            .once("value", (snapshot) => {
                if(snapshot.exists()){
                    app_id.length = 0;
                    created_app_id = false;
                }
            });
    }

    const app_id_str = app_id.join("");
    const new_user = createUser(app_id_str);

    // https://stackoverflow.com/questions/47003289/firebase-push-item-custom-key?rq=1
    admin.database().ref('/app_ids').child(app_id_str).set(true);

    return admin.database().ref('/users').push(new_user)
        .then((snapshot) => {
            return resp.redirect(303, snapshot.ref.toString());
        });
});

function createUser(app_id){
    return {
        device_id: app_id,
        created_timestamp: new Date().getTime(),
        images_uploaded: [],
        image_pairs_uploaded: [],
        image_viewed: [],
        image_pair_votes: []
    }
}

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });
