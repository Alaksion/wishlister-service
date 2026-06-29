export interface StorageService {
  deleteObject(key: string): Promise<void>;
  deleteObjects(keys: string[]): Promise<void>;
}

export class ConsoleStorageService implements StorageService {
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
