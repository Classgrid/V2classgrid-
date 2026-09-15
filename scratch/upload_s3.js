import { S3Client, PutObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: 'c:\\V2classgrid-\\.env' });

const s3Client = new S3Client({
    region: process.env.AWS_S3_ERP_REGION,
    credentials: {
        accessKeyId: process.env.AWS_S3_ERP_ACCESS_KEY,
        secretAccessKey: process.env.AWS_S3_ERP_SECRET_KEY,
    }
});

const bucketName = process.env.AWS_S3_ERP_BUCKET_NAME;

async function deleteFiles(keys) {
    const command = new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: {
            Objects: keys.map(key => ({ Key: key }))
        }
    });
    try {
        await s3Client.send(command);
        console.log(`Successfully deleted ${keys.join(', ')}`);
    } catch (err) {
        console.error(`Error deleting files:`, err);
    }
}

async function uploadFile(filePath, key, contentType) {
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return;
    }
    
    const fileStream = fs.createReadStream(filePath);
    
    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: fileStream,
        ContentType: contentType
    });

    try {
        await s3Client.send(command);
        console.log(`Successfully uploaded ${key} to ${bucketName}`);
    } catch (err) {
        console.error(`Error uploading ${key}:`, err);
    }
}

async function main() {
    await deleteFiles([
        'v2classgrid-release-2.apk',
        'v2classgrid-release-3.apk',
        'v2classgrid-release-4.apk'
    ]);

    const apkPath = 'c:\\V2classgrid-\\android-wrapper\\app\\build\\outputs\\apk\\debug\\app-debug.apk';
    await uploadFile(apkPath, 'v2_classgrid_app_8.apk', 'application/vnd.android.package-archive');
}

main();
