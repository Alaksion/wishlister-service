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
}

export class ConsoleStorageService implements StorageService {
  async uploadObject(key: string, _buffer: Buffer, contentType: string): Promise<UploadedObject> {
    console.log(`Uploading storage object: ${key} (${contentType})`);
    return {
      key,
      url: `https://example.com/${key}`,
    };
  }

  async deleteObject(key: string): Promise<void> {
    console.log(`Deleting storage object: ${key}`);
  }

  async deleteObjects(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.deleteObject(key);
    }
  }

  async moveObject(sourceKey: string, destinationKey: string): Promise<UploadedObject> {
    console.log(`Moving storage object: ${sourceKey} -> ${destinationKey}`);
    return {
      key: destinationKey,
      url: `https://example.com/${destinationKey}`,
    };
  }
}

export function createStorageService(): StorageService {
  if (
    config.AWS_S3_BUCKET_NAME !== undefined &&
    config.AWS_ACCESS_KEY_ID !== undefined &&
    config.AWS_SECRET_ACCESS_KEY !== undefined
  ) {
    return new S3StorageService(new S3Client(buildS3ClientConfig()));
  }
  return new ConsoleStorageService();
}
