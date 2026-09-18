import crypto from 'crypto';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from './env';

export const r2Enabled = Boolean(
  env.r2AccountId && env.r2AccessKeyId && env.r2SecretAccessKey && env.r2Bucket && env.r2PublicUrl,
);

const client = r2Enabled
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${env.r2AccountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: env.r2AccessKeyId, secretAccessKey: env.r2SecretAccessKey },
    })
  : null;

/**
 * Luu anh len Cloudflare R2 thay vi dia cuc bo — dia cua Render bi xoa trang moi
 * lan deploy lai nen anh upload truoc do se mat, con R2 thi ton tai vinh vien.
 * URL tra ve la tuyet doi (R2_PUBLIC_URL) va khong bao gio duoc rut gon lai thanh
 * duong dan tuong doi (xem toRelativePath trong lib/url.ts).
 */
export async function uploadToR2(buffer: Buffer, originalName: string, mimetype: string): Promise<string> {
  if (!client) throw new Error('R2_NOT_CONFIGURED');
  const now = new Date();
  const ext = path.extname(originalName) || '.jpg';
  const key = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${crypto.randomBytes(12).toString('hex')}${ext}`;
  await client.send(new PutObjectCommand({ Bucket: env.r2Bucket, Key: key, Body: buffer, ContentType: mimetype }));
  return `${env.r2PublicUrl}/${key}`;
}
