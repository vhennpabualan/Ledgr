import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';
import { AppError } from '../lib/errors';

function getS3Client(): S3Client {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    throw new AppError(500, 'R2 storage is not configured');
  }
  return new S3Client({
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    region: 'auto',
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

export interface PresignedUploadResult {
  uploadUrl: string;  // pre-signed PUT URL (expires in 15 min)
  receiptUrl: string; // public CDN URL to store on the expense record
}

/** Strip path separators; keep only alphanumeric, `.`, `-`, `_` */
function sanitizeFilename(filename: string): string {
  return filename.replace(/[/\\]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function generatePresignedUploadUrl(
  userId: string,
  expenseId: string,
  filename: string,
): Promise<PresignedUploadResult> {
  const s3 = getS3Client();
  const sanitizedFilename = sanitizeFilename(filename);
  const key = `receipts/${userId}/${expenseId}/${sanitizedFilename}`;

  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });
  const receiptUrl = `${env.R2_PUBLIC_URL}/${key}`;

  return { uploadUrl, receiptUrl };
}

export async function deleteReceiptByUrl(receiptUrl: string): Promise<void> {
  const s3 = getS3Client();
  const key = receiptUrl.replace(`${env.R2_PUBLIC_URL}/`, '');

  await s3.send(new DeleteObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
  }));
}
