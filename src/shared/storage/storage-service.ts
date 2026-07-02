import { config } from '../config/config.js';
import { S3StorageService, buildS3ClientConfig } from './s3-storage-service.js';
import { S3Client } from '@aws-sdk/client-s3';

export interface UploadedObject {
  key: string;
  url: string;
}

export interface StorageService {
  uploadObject(key: string, buffer: Buffer, contentType: string): Promise<UploadedObject>;
  deleteObject(key: string): Promise<void>;
  deleteObjects(keys: string[]): Promise<void>;
  moveObject(sourceKey: string, destinationKey: string): Promise<UploadedObject>;
  getObjectUrl(key: string): string;
}

export function createStorageService(): StorageService {
  const bucketName = config.AWS_S3_BUCKET_NAME;
  const accessKeyId = config.AWS_ACCESS_KEY_ID;
  const secretAccessKey = config.AWS_SECRET_ACCESS_KEY;

  if (bucketName === undefined || accessKeyId === undefined || secretAccessKey === undefined) {
    throw new Error(
      'Storage service requires AWS_S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY'
    );
  }

  return new S3StorageService(new S3Client(buildS3ClientConfig()));
}
