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

export interface ListedObject {
  key: string;
  lastModified: Date;
}

export class S3StorageService implements StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrlPrefix: string;

  constructor(
    client: S3Client,
    bucket: string = config.AWS_S3_BUCKET_NAME ?? '',
    publicUrlPrefix: string = config.S3_PUBLIC_URL_PREFIX ?? buildDefaultPublicUrlPrefix()
  ) {
    if (bucket === '') {
      throw new Error('S3StorageService requires a bucket name');
    }
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
      url: this.getObjectUrl(key),
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
      url: this.getObjectUrl(destinationKey),
    };
  }

  getObjectUrl(key: string): string {
    return `${this.publicUrlPrefix}${key}`;
  }

  async listKeys(prefix: string): Promise<ListedObject[]> {
    const keys: ListedObject[] = [];
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
}

function buildDefaultPublicUrlPrefix(): string {
  const bucket = config.AWS_S3_BUCKET_NAME;
  if (bucket === undefined) {
    throw new Error('Cannot build default S3 public URL prefix without a bucket name');
  }
  return `https://${bucket}.s3.${config.AWS_REGION}.amazonaws.com/`;
}

export function buildS3ClientConfig(): S3ClientConfig {
  const accessKeyId = config.AWS_ACCESS_KEY_ID;
  const secretAccessKey = config.AWS_SECRET_ACCESS_KEY;

  if (accessKeyId === undefined || secretAccessKey === undefined) {
    throw new Error('S3 client configuration requires AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY');
  }

  const clientConfig: S3ClientConfig = {
    region: config.AWS_REGION,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  };

  if (config.S3_ENDPOINT !== undefined) {
    clientConfig.endpoint = config.S3_ENDPOINT;
    clientConfig.forcePathStyle = true;
  }

  return clientConfig;
}
