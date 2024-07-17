const AWS = require('aws-sdk');
const uuid = require('uuid');
const path = require('path');

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

async function uploadFile(fileName, fileContent, dont_customize_name) {
  return new Promise((resolve, reject) => {
    // setting up s3 upload parameters
    const params = {
      Bucket: BUCKET_NAME,
      Key: dont_customize_name ? fileName : `${path.parse(fileName).name}-${uuid.v4()}${path.parse(fileName).ext}`,
      Body: Buffer.from(fileContent.split(';base64,')[1], 'base64')
    };

    // Uploading files to the bucket
    s3.upload(params, function (err, data) {
      if (err) {
        return reject(err)
      } else {
        return resolve(data.Location)
      }
    });
  })
}

module.exports = {
  uploadFile
}