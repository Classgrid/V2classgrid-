import { S3Client, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
    region: process.env.AWS_S3_ERP_REGION?.trim(),
    credentials: {
        accessKeyId: process.env.AWS_S3_ERP_ACCESS_KEY?.trim(),
        secretAccessKey: process.env.AWS_S3_ERP_SECRET_KEY?.trim(),
    },
});

const BUCKET_NAME = process.env.AWS_S3_ERP_BUCKET_NAME?.trim();
const CLOUDFRONT_DOMAIN = process.env.AWS_CLOUDFRONT_ERP_DOMAIN?.trim();

export const s3Storage = {
    // Generate a presigned URL for direct client-side upload
    createSignedUploadUrl: async (path, expiresIn = 3600, contentType = "application/octet-stream") => {
        const fullPath = `notes-files/${path}`;
        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: fullPath,
            ContentType: contentType,
        });

        // The URL returned here will be the pre-signed S3 URL for upload
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
        return { signedUrl, fullPath };
    },

    // Return the public CloudFront URL for a given path
    getPublicUrl: (path) => {
        const cleanPath = path.startsWith('notes-files/') ? path : `notes-files/${path}`;
        return `${CLOUDFRONT_DOMAIN}/${cleanPath}`;
    },

    // Server-side upload (used for base64 logo uploads, etc)
    uploadFile: async (path, buffer, contentType) => {
        const fullPath = `notes-files/${path}`;
        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: fullPath,
            Body: buffer,
            ContentType: contentType,
        });

        await s3Client.send(command);
        return { publicUrl: s3Storage.getPublicUrl(path), fullPath };
    },

    // Delete a single file
    deleteFile: async (path) => {
        const fullPath = path.startsWith('notes-files/') ? path : `notes-files/${path}`;
        const command = new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: fullPath,
        });
        return s3Client.send(command);
    },

    // Delete multiple files
    deleteFiles: async (paths) => {
        if (!paths || paths.length === 0) return;
        
        const objects = paths.map(path => {
            const cleanPath = path.startsWith('notes-files/') ? path : `notes-files/${path}`;
            return { Key: cleanPath };
        });

        const command = new DeleteObjectsCommand({
            Bucket: BUCKET_NAME,
            Delete: { Objects: objects }
        });
        return s3Client.send(command);
    },

    // List files under a prefix
    listFiles: async (prefix, maxKeys = 1000, continuationToken = null) => {
        const fullPrefix = prefix.startsWith('notes-files/') ? prefix : `notes-files/${prefix}`;
        const command = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: fullPrefix,
            MaxKeys: maxKeys,
            ContinuationToken: continuationToken,
        });

        const response = await s3Client.send(command);
        
        // Map to format somewhat similar to what Supabase returns for compatibility
        const files = (response.Contents || []).map(item => ({
            name: item.Key.split('/').pop(),
            metadata: {
                size: item.Size,
                mimetype: item.ContentType, // S3 doesn't return ContentType in list operations by default, but keeping field for structure
                lastModified: item.LastModified
            }
        }));

        return {
            data: files,
            nextContinuationToken: response.NextContinuationToken,
            hasMore: !!response.NextContinuationToken
        };
    }
};
