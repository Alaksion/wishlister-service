export interface UploadedObject {
  key: string;
  url: string;
}

export interface StorageService {
  uploadObject(key: string, buffer: Buffer, contentType: string): Promise<UploadedObject>;
  deleteObject(key: string): Promise<void>;
  deleteObjects(keys: string[]): Promise<void>;
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
}

export function createStorageService(): StorageService {
  return new ConsoleStorageService();
}
