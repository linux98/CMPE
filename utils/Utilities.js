/**
 * Competition Platform Engineering Standards (CPES)
 * Core System Utilities & Hexagonal Adapters
 */

const CMPE_UTILITIES = {
  /**
   * Generates a standard cryptographically secure UUIDv4
   */
  generateUuid() {
    return Utilities.getUuid();
  },

  /**
   * SHA-256 Hashing helper with password stretching and salt
   */
  hashPassword(password, salt, iterations = 1000) {
    let hash = password + salt;
    for (let i = 0; i < iterations; i++) {
      const digest = Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256,
        hash,
        Utilities.Charset.UTF_8
      );
      // Convert byte array to hexadecimal string representation
      hash = digest.map(byte => {
        const val = (byte & 0xff).toString(16);
        return val.length === 1 ? "0" + val : val;
      }).join("");
    }
    return hash;
  },

  /**
   * Constant time comparison helper
   */
  constantTimeCompare(str1, str2) {
    if (typeof str1 !== "string" || typeof str2 !== "string") return false;
    if (str1.length !== str2.length) return false;
    let result = 0;
    for (let i = 0; i < str1.length; i++) {
      result |= str1.charCodeAt(i) ^ str2.charCodeAt(i);
    }
    return result === 0;
  },

  /**
   * Formats successful API payloads according to CMPE standards
   */
  successEnvelope(data, requestId, rowVersion = 1) {
    return {
      success: true,
      requestId: requestId || this.generateUuid(),
      data: data,
      meta: {
        serverTimestamp: new Date().toISOString(),
        rowVersion: rowVersion
      }
    };
  },

  /**
   * Formats API error payloads according to CMPE standards
   */
  errorEnvelope(code, message, details = [], requestId) {
    return {
      success: false,
      requestId: requestId || this.generateUuid(),
      error: {
        code: code || "ERR_DOMAIN_000",
        message: message || "An unexpected error occurred.",
        details: details
      }
    };
  },

  /**
   * Enforces name validation boundaries (alphabetical only)
   */
  isValidName(name) {
    if (typeof name !== "string" || !name.trim()) return false;
    // Allows Thai consonants, vowels, and standard English alphabet chars
    const nameRegex = /^[A-Za-z\u0e01-\u0e4f\s\.]+$/;
    return nameRegex.test(name);
  }
};
