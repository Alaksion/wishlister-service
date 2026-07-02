import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { S3StorageService } from './s3-storage-service.js';

class MockS3Client {
  send = vi.fn();
}

describe('S3StorageService', () => {
  let mockClient: MockS3Client;
  let service: S3StorageService;

  beforeEach(() => {
    mockClient = new MockS3Client();
    service = new S3StorageService(
      mockClient as unknown as S3Client,
      'test-bucket',
      'https://cdn.example.com/'
    );
  });

  describe('uploadObject', () => {
    it('uploads a buffer and returns the public URL', async () => {
      mockClient.send.mockResolvedValueOnce({});

      const result = await service.uploadObject(
        'users/1/item/photo.png',
        Buffer.from('image'),
        'image/png'
      );

      expect(mockClient.send).toHaveBeenCalledWith(expect.any(PutObjectCommand));
      const command = mockClient.send.mock.calls[0]![0] as PutObjectCommand;
      expect(command.input).toEqual({
        Bucket: 'test-bucket',
        Key: 'users/1/item/photo.png',
        Body: expect.any(Buffer),
        ContentType: 'image/png',
      });
      expect(result).toEqual({
        key: 'users/1/item/photo.png',
        url: 'https://cdn.example.com/users/1/item/photo.png',
      });
    });

    it('adds a trailing slash to the public URL prefix if missing', async () => {
      service = new S3StorageService(
        mockClient as unknown as S3Client,
        'test-bucket',
        'https://cdn.example.com'
      );
      mockClient.send.mockResolvedValueOnce({});

      const result = await service.uploadObject('file.txt', Buffer.from('data'), 'text/plain');

      expect(result.url).toBe('https://cdn.example.com/file.txt');
    });
  });

  describe('deleteObject', () => {
    it('deletes a single object', async () => {
      mockClient.send.mockResolvedValueOnce({});

      await service.deleteObject('users/1/item/photo.png');

      expect(mockClient.send).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
      const command = mockClient.send.mock.calls[0]![0] as DeleteObjectCommand;
      expect(command.input).toEqual({
        Bucket: 'test-bucket',
        Key: 'users/1/item/photo.png',
      });
    });
  });

  describe('deleteObjects', () => {
    it('deletes multiple objects in one request', async () => {
      mockClient.send.mockResolvedValueOnce({});

      await service.deleteObjects(['a.png', 'b.png']);

      expect(mockClient.send).toHaveBeenCalledWith(expect.any(DeleteObjectsCommand));
      const command = mockClient.send.mock.calls[0]![0] as DeleteObjectsCommand;
      expect(command.input).toEqual({
        Bucket: 'test-bucket',
        Delete: {
          Objects: [{ Key: 'a.png' }, { Key: 'b.png' }],
        },
      });
    });

    it('does nothing for an empty key list', async () => {
      await service.deleteObjects([]);

      expect(mockClient.send).not.toHaveBeenCalled();
    });
  });

  describe('moveObject', () => {
    it('copies the object to the destination and deletes the source', async () => {
      mockClient.send.mockResolvedValueOnce({});
      mockClient.send.mockResolvedValueOnce({});

      const result = await service.moveObject('staging/1/item/photo.png', '1/item/photo.png');

      expect(mockClient.send).toHaveBeenCalledTimes(2);
      expect(mockClient.send).toHaveBeenNthCalledWith(1, expect.any(CopyObjectCommand));
      expect(mockClient.send).toHaveBeenNthCalledWith(2, expect.any(DeleteObjectCommand));

      const copyCommand = mockClient.send.mock.calls[0]![0] as CopyObjectCommand;
      expect(copyCommand.input).toEqual({
        Bucket: 'test-bucket',
        Key: '1/item/photo.png',
        CopySource: 'test-bucket%2Fstaging%2F1%2Fitem%2Fphoto.png',
      });

      const deleteCommand = mockClient.send.mock.calls[1]![0] as DeleteObjectCommand;
      expect(deleteCommand.input).toEqual({
        Bucket: 'test-bucket',
        Key: 'staging/1/item/photo.png',
      });

      expect(result).toEqual({
        key: '1/item/photo.png',
        url: 'https://cdn.example.com/1/item/photo.png',
      });
    });
  });

  describe('listKeys', () => {
    it('returns keys and last modified dates under a prefix', async () => {
      const lastModified = new Date('2026-01-01T00:00:00Z');
      mockClient.send.mockResolvedValueOnce({
        Contents: [
          { Key: 'staging/1/item/a.png', LastModified: lastModified },
          { Key: 'staging/1/item/b.png', LastModified: lastModified },
        ],
        NextContinuationToken: undefined,
      });

      const result = await service.listKeys('staging/1/item/');

      expect(mockClient.send).toHaveBeenCalledWith(expect.any(ListObjectsV2Command));
      const command = mockClient.send.mock.calls[0]![0] as ListObjectsV2Command;
      expect(command.input).toEqual({
        Bucket: 'test-bucket',
        Prefix: 'staging/1/item/',
      });
      expect(result).toEqual([
        { key: 'staging/1/item/a.png', lastModified },
        { key: 'staging/1/item/b.png', lastModified },
      ]);
    });

    it('paginates through all continuation tokens', async () => {
      mockClient.send
        .mockResolvedValueOnce({
          Contents: [{ Key: 'a.png', LastModified: new Date() }],
          NextContinuationToken: 'token-1',
        })
        .mockResolvedValueOnce({
          Contents: [{ Key: 'b.png', LastModified: new Date() }],
          NextContinuationToken: undefined,
        });

      const result = await service.listKeys('staging/');

      expect(mockClient.send).toHaveBeenCalledTimes(2);
      const secondCommand = mockClient.send.mock.calls[1]![0] as ListObjectsV2Command;
      expect(secondCommand.input.ContinuationToken).toBe('token-1');
      expect(result).toHaveLength(2);
    });
  });
});
