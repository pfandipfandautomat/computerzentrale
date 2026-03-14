import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

class EncryptionService {
  private getSecretKey(): string {
    const secret = process.env.ENCRYPTION_SECRET;
    if (!secret) {
      throw new Error('ENCRYPTION_SECRET environment variable is not set');
    }
    if (secret.length < 32) {
      throw new Error('ENCRYPTION_SECRET must be at least 32 characters long');
    }
    return secret;
  }

  private deriveKey(secret: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(secret, salt, ITERATIONS, KEY_LENGTH, 'sha512');
  }

  /**
   * Encrypt a string using AES-256-GCM
   * Returns: base64 encoded string containing salt + iv + tag + encrypted data
   */
  encrypt(plaintext: string): string {
    const secret = this.getSecretKey();
    
    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Derive key from secret and salt
    const key = this.deriveKey(secret, salt);
    
    // Create cipher and encrypt
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    
    // Get auth tag
    const tag = cipher.getAuthTag();
    
    // Combine: salt + iv + tag + encrypted
    const combined = Buffer.concat([salt, iv, tag, encrypted]);
    
    return combined.toString('base64');
  }

  /**
   * Decrypt a string that was encrypted with encrypt()
   */
  decrypt(encryptedData: string): string {
    const secret = this.getSecretKey();
    
    // Decode from base64
    const combined = Buffer.from(encryptedData, 'base64');
    
    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    
    // Derive key from secret and salt
    const key = this.deriveKey(secret, salt);
    
    // Create decipher and decrypt
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    
    return decrypted.toString('utf8');
  }

  /**
   * Check if encryption is properly configured
   */
  isConfigured(): boolean {
    try {
      this.getSecretKey();
      return true;
    } catch {
      return false;
    }
  }
}

export const encryptionService = new EncryptionService();
