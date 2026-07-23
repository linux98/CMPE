/**
 * Competition Platform Engineering Standards (CPES)
 * Authentication & Authorization Domain Layer
 */

class UserEntity {
  constructor(data) {
    this.userId = data.userId || "";
    this.username = data.username || "";
    this.passwordHash = data.passwordHash || "";
    this.salt = data.salt || "";
    this.iterations = parseInt(data.iterations) || 1000;
    this.status = data.status || "ACTIVE"; // ACTIVE, LOCKED, SUSPENDED
    this.failedLoginCount = parseInt(data.failedLoginCount) || 0;
    this.lockoutUntil = data.lockoutUntil || ""; // ISO timestamp
    this.passwordExpiredTimestamp = data.passwordExpiredTimestamp || "";
    
    // Metadata columns
    this.tenantId = data.tenantId || "";
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }

  isLocked(currentTimeIso) {
    if (this.status === "LOCKED") return true;
    if (this.lockoutUntil) {
      return new Date(this.lockoutUntil).getTime() > new Date(currentTimeIso).getTime();
    }
    return false;
  }

  isPasswordExpired(currentTimeIso) {
    if (!this.passwordExpiredTimestamp) return false;
    return new Date(this.passwordExpiredTimestamp).getTime() < new Date(currentTimeIso).getTime();
  }
}

class UserSessionEntity {
  constructor(data) {
    this.sessionId = data.sessionId || "";
    this.userId = data.userId || "";
    this.sessionTokenHash = data.sessionTokenHash || "";
    this.expiryTimestamp = data.expiryTimestamp || "";
    this.deviceId = data.deviceId || "";
    this.ipAddress = data.ipAddress || "";
    this.rememberMe = data.rememberMe === true || data.rememberMe === "true";
    
    // Metadata columns
    this.tenantId = data.tenantId || "";
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }

  isExpired(currentTimeIso) {
    return new Date(this.expiryTimestamp).getTime() < new Date(currentTimeIso).getTime();
  }
}

class AuthDomainService {
  constructor(userRepo, sessionRepo, passwordHasher, clock) {
    this.userRepo = userRepo;
    this.sessionRepo = sessionRepo;
    this.passwordHasher = passwordHasher;
    this.clock = clock;
  }

  /**
   * Performs core user login verification checks
   */
  authenticate(username, password, tenantId, deviceId, ipAddress) {
    const now = this.clock.nowIsoString();
    const userRow = this.userRepo.findByUsername(username, tenantId);
    
    if (!userRow) {
      this.userRepo.logFailedLogin(username, ipAddress, deviceId, now);
      throw new Error("ERR_AUTH_001: Invalid username or password.");
    }
    
    const user = new UserEntity(userRow);
    
    // Check account status locks
    if (user.isLocked(now)) {
      throw new Error("ERR_AUTH_002: This account is temporarily locked due to excessive failed attempts.");
    }
    
    // Check password hash match
    const computedHash = this.passwordHasher.hash(password, user.salt, user.iterations);
    const matches = this.passwordHasher.constantTimeCompare(computedHash, user.passwordHash);
    
    if (!matches) {
      // Increment failed logins count
      user.failedLoginCount += 1;
      if (user.failedLoginCount >= 5) {
        user.status = "LOCKED";
        // Lock for exactly 15 minutes
        const lockoutTime = new Date(new Date(now).getTime() + 15 * 60 * 1000).toISOString();
        user.lockoutUntil = lockoutTime;
        this.userRepo.logSecurityEvent(user.userId, "ACCOUNT_LOCKED", `Locked until ${lockoutTime}`, ipAddress, deviceId);
      }
      this.userRepo.update(user, user.rowVersion, { userId: "SYSTEM", tenantId });
      this.userRepo.logFailedLogin(username, ipAddress, deviceId, now);
      throw new Error("ERR_AUTH_001: Invalid username or password.");
    }
    
    // Success: Reset failed checks count
    user.failedLoginCount = 0;
    user.lockoutUntil = "";
    this.userRepo.update(user, user.rowVersion, { userId: user.userId, tenantId });
    
    this.userRepo.logSuccessLogin(username, ipAddress, deviceId, now);
    
    return user;
  }
}
