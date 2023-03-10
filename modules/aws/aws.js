const AWS = require('aws-sdk');

// Enter copied or downloaded access id and secret here
const ID = process.env.AWS_ACCESS_KEY_ID;
const SECRET = process.env.AWS_SECRET_ACCESS_KEY;

// Enter the name of the bucket that you have created here
const BUCKET_NAME = process.env.AWS_S3_BUCKET;

// Initializing S3 Interface
const s3 = new AWS.S3({
    accessKeyId: ID,
    secretAccessKey: SECRET
});

async function uploadFile(fileName,fileContent) {
  return new Promise((resolve,reject) => {
    // setting up s3 upload parameters
    const params = {
        Bucket: BUCKET_NAME,
        Key: fileName, // file name you want to save as
        Body: fileContent
    };
  
    // Uploading files to the bucket
    s3.upload(params, function(err, data) {
        if (err) {
          return reject(err)
        } else {
          return resolve(data.location)
        }
    });
  })
}

module.exports = {
  uploadFile
}