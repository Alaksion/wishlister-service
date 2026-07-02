import {
  S3Client,
  type S3ClientConfig,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  CopyObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import type { StorageService, UploadedObject } from './storage-service.js';
import { config } from '../config/config.js';

export class S3StorageService implements StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrlPrefix: string;

  constructor(
    client: S3Client = new S3Client(buildS3ClientConfig()),
    bucket: string = config.AWS_S3_BUCKET_NAME,
    publicUrlPrefix: string = config.S3_PUBLIC_URL_PREFIX ?? buildDefaultPublicUrlPrefix()
  ) {
    this.client = client;
    this.bucket = bucket;
    this.publicUrlPrefix = publicUrlPrefix.endsWith('/') ? publicUrlPrefix : `${publicUrlPrefix}/`;
  }

  async uploadObject(key: string, buffer: Buffer, contentType: string): Promise<UploadedObject> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );

    return {
      key,
      url: this.buildPublicUrl(key),
    };
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
  }

  async deleteObjects(keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }

    await this.client.send(
      new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: {
          Objects: keys.map((key) => ({ Key: key })),
        },
      })
    );
  }

  async moveObject(sourceKey: string, destinationKey: string): Promise<UploadedObject> {
    const copySource = encodeURIComponent(`${this.bucket}/${sourceKey}`);

    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        Key: destinationKey,
        CopySource: copySource,
      })
    );

    await this.deleteObject(sourceKey);

    return {
      key: destinationKey,
      url: this.buildPublicUrl(destinationKey),
    };
  }

  async listKeys(prefix: string): Promise<Array<{ key: string; lastModified: Date }>> {
    const keys: Array<{ key: string; lastModified: Date }> = [];
    let continuationToken: string | undefined;

    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })
      );

      for (const object of response.Contents ?? []) {
        if (object.Key !== undefined && object.LastModified !== undefined) {
          keys.push({ key: object.Key, lastModified: object.LastModified });
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return keys;
  }

  private buildPublicUrl(key: string): string {
    return `${this.publicUrlPrefix}${key}`;
  }
}

function buildDefaultPublicUrlPrefix(): string {
  const { AWS_S3_BUCKET_NAME: bucket, AWS_REGION: region } = config;
  return `https://${bucket}.s3.${region}.amazonaws.com/`;
}

function buildS3ClientConfig(): S3ClientConfig {
  const clientConfig: S3ClientConfig = {
    region: config.AWS_REGION,
    credentials: {
      accessKeyId: config.AWS_ACCESS_KEY_ID,
      secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
    },
  };

  if (config.S3_ENDPOINT !== undefined) {
    clientConfig.endpoint = config.S3_ENDPOINT;
    clientConfig.forcePathStyle = true;
  }

  return clientConfig;
}

export function createS3StorageService(): S3StorageService {
  return new S3StorageService();
}
