/**
 * Competition Platform Engineering Standards (CPES)
 * Password Hasher Infrastructure Adapter
 */

class PasswordHasher extends IPasswordHasher {
  /**
   * Generates iterative salted SHA-256 stretch hash values
   */
  hash(password, salt, iterations = 1000) {
    return CMPE_UTILITIES.hashPassword(password, salt, iterations);
  }

  /**
   * Generates a unique secure random salt
   */
  generateSalt() {
    return CMPE_UTILITIES.generateUuid().replace(/-/g, "").substring(0, 16);
  }

  /**
   * Compares two hashes in constant-time to mitigate timing attack vectors
   */
  constantTimeCompare(hash1, hash2) {
    return CMPE_UTILITIES.constantTimeCompare(hash1, hash2);
  }
}
