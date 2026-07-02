import type { StorageService, UploadedObject } from '../../shared/storage/storage-service.js';

export class FakeStorageService implements StorageService {
  uploadedObjects: Array<{ key: string; contentType: string }> = [];
  deletedKeys: string[] = [];
  movedObjects: Array<{ sourceKey: string; destinationKey: string }> = [];
  uploadFailures: Map<string, Error> = new Map();
  moveFailures: Map<string, Error> = new Map();
  deleteObjectsFailure: Error | null = null;

  async uploadObject(key: string, _buffer: Buffer, contentType: string): Promise<UploadedObject> {
    if (this.uploadFailures.has(key) || this.uploadFailures.has('match-any')) {
      throw this.uploadFailures.get(key) ?? this.uploadFailures.get('match-any')!;
    }
    this.uploadedObjects.push({ key, contentType });
    return {
      key,
      url: `https://example.com/${key}`,
    };
  }

  async deleteObject(key: string): Promise<void> {
    this.deletedKeys.push(key);
  }

  async deleteObjects(keys: string[]): Promise<void> {
    if (this.deleteObjectsFailure !== null) {
      throw this.deleteObjectsFailure;
    }
    this.deletedKeys.push(...keys);
  }

  async moveObject(sourceKey: string, destinationKey: string): Promise<UploadedObject> {
    if (this.moveFailures.has(sourceKey) || this.moveFailures.has('match-any')) {
      throw this.moveFailures.get(sourceKey) ?? this.moveFailures.get('match-any')!;
    }
    this.movedObjects.push({ sourceKey, destinationKey });
    return {
      key: destinationKey,
      url: `https://example.com/${destinationKey}`,
    };
  }

  getObjectUrl(key: string): string {
    return `https://example.com/${key}`;
  }
}

export function createFakeImageBuffer(): Buffer {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
}
