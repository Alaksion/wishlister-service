import { config } from '../config/config.js';
import { S3StorageService } from './s3-storage-service.js';

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
  if (config.NODE_ENV === 'production' || config.S3_ENDPOINT !== undefined) {
    return new S3StorageService();
  }
  return new ConsoleStorageService();
}
