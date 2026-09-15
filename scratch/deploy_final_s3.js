import { S3Client, ListObjectsV2Command, DeleteObjectsCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const client = new S3Client({
    region: process.env.AWS_S3_ERP_REGION,
    credentials: {
        accessKeyId: process.env.AWS_S3_ERP_ACCESS_KEY,
        secretAccessKey: process.env.AWS_S3_ERP_SECRET_KEY,
    }
});
const bucket = process.env.AWS_S3_ERP_BUCKET_NAME;

async function deploy() {
    try {
        console.log('Listing objects in ' + bucket + '...');
        const listRes = await client.send(new ListObjectsV2Command({ Bucket: bucket }));
        const objectsToDelete = listRes.Contents
            .filter(obj => obj.Key.endsWith('.apk'))
            .map(obj => ({ Key: obj.Key }));
        
        if (objectsToDelete.length > 0) {
            console.log(`Deleting ${objectsToDelete.length} old APKs...`);
            await client.send(new DeleteObjectsCommand({
                Bucket: bucket,
                Delete: { Objects: objectsToDelete }
            }));
            console.log('Deleted old APKs successfully.');
        }

        const apkPath = 'android-wrapper/app/build/outputs/apk/debug/app-debug.apk';
        const fileContent = fs.readFileSync(apkPath);
        
        console.log('Uploading final APK as v2classgrid.apk...');
        await client.send(new PutObjectCommand({
            Bucket: bucket,
            Key: 'v2classgrid.apk',
            Body: fileContent,
            ContentType: 'application/vnd.android.package-archive',
            ContentDisposition: 'attachment; filename="Classgrid.apk"',
            CacheControl: 'no-cache, no-store, must-revalidate'
        }));
        console.log('Upload complete! https://cdn.classgrid.in/v2classgrid.apk');
    } catch (e) {
        console.error('Error:', e);
    }
}
deploy();
