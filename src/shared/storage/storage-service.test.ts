import { describe, expect, it } from 'vitest';
import { createStorageService } from './storage-service.js';

describe('createStorageService', () => {
  it('throws a clear error when S3 credentials are missing', () => {
    expect(() => createStorageService()).toThrow(
      'Storage service requires AWS_S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY'
    );
  });
});
