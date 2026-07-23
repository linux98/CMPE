/**
 * Competition Platform Engineering Standards (CPES)
 * Session Management Domain Service
 */

class SessionManager {
  constructor(sessionRepo, userRepo, rbacRepo, passwordHasher, clock) {
    this.sessionRepo = sessionRepo;
    this.userRepo = userRepo;
    this.rbacRepo = rbacRepo;
    this.passwordHasher = passwordHasher;
    this.clock = clock;
  }

  /**
   * Generates a new session for a user, enforcing concurrent session limits
   */
  createSession(userId, tenantId, deviceId, ipAddress, rememberMe = false) {
    const rawToken = CMPE_UTILITIES.generateUuid();
    const tokenHash = this.passwordHasher.hash(rawToken, "SESSION_SALT_CONST", 1);
    
    const now = this.clock.nowIsoString();
    
    // Check concurrent sessions (max 5 active sessions allowed per user)
    const activeSessions = this.sessionRepo.findActiveSessionsForUser(userId);
    if (activeSessions.length >= 5) {
      // Sort by lastModifiedTimestamp to find the oldest session and archive it
      activeSessions.sort((a, b) => new Date(a.lastModifiedTimestamp) - new Date(b.lastModifiedTimestamp));
      const oldest = activeSessions[0];
      this.sessionRepo.archive(oldest.sessionId, oldest.rowVersion, { userId: "SYSTEM", tenantId });
    }
    
    // Expiry calculation: 30 days for Remember Me, 4 hours default
    const durationMs = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 4 * 60 * 60 * 1000;
    const expiryTimestamp = new Date(new Date(now).getTime() + durationMs).toISOString();
    
    const session = new UserSessionEntity({
      sessionId: CMPE_UTILITIES.generateUuid(),
      userId: userId,
      sessionTokenHash: tokenHash,
      expiryTimestamp: expiryTimestamp,
      deviceId: deviceId || "UNKNOWN",
      ipAddress: ipAddress || "UNKNOWN",
      rememberMe: rememberMe,
      tenantId: tenantId
    });
    
    this.sessionRepo.create(session, { userId: userId, tenantId });
    
    return {
      rawToken: rawToken,
      expiryTimestamp: expiryTimestamp
    };
  }

  /**
   * Validates active session tokens and returns user capabilities profile
   */
  verifySession(token, tenantId) {
    const tokenHash = this.passwordHasher.hash(token, "SESSION_SALT_CONST", 1);
    const actorCache = CacheService.getScriptCache();
    const actorCacheKey = "session_actor:" + tokenHash + ":" + tenantId;
    const cachedActor = actorCache.get(actorCacheKey);
    if (cachedActor) {
      try {
        return JSON.parse(cachedActor);
      } catch (ignored) {
        actorCache.remove(actorCacheKey);
      }
    }
    const sessionRow = this.sessionRepo.findByTokenHash(tokenHash);
    
    if (!sessionRow) {
      throw new Error("ERR_AUTH_003: Session is invalid or has been revoked.");
    }
    
    const session = new UserSessionEntity(sessionRow);
    const now = this.clock.nowIsoString();
    
    if (session.isExpired(now)) {
      this.sessionRepo.archive(session.sessionId, session.rowVersion, { userId: session.userId, tenantId });
      throw new Error("ERR_AUTH_003: Session has expired.");
    }
    
    if (session.tenantId !== tenantId) {
      throw new Error("ERR_TENANT_ISOLATION_VIOLATION: Cross-tenant session execution blocked.");
    }
    
    // Retrieve associated user profile details
    const userRow = this.userRepo.findById(session.userId, tenantId);
    if (!userRow || userRow.recordStatus === "DELETED") {
      throw new Error("ERR_AUTH_003: Associated user account was deleted or suspended.");
    }
    
    // Fetch RBAC roles and permissions
    const rbac = this.rbacRepo.getUserRolesAndPermissions(session.userId, tenantId);
    
    const actor = {
      userId: session.userId,
      username: userRow.username,
      tenantId: session.tenantId,
      roles: rbac.roles,
      permissions: rbac.permissions
    };
    // A deliberately short cache removes repeated 6-sheet authentication reads
    // during page bootstrap while keeping logout/permission changes responsive.
    actorCache.put(actorCacheKey, JSON.stringify(actor), 20);
    return actor;
  }

  /**
   * Renews session expiration time
   */
  renewSession(token, tenantId) {
    const tokenHash = this.passwordHasher.hash(token, "SESSION_SALT_CONST", 1);
    const sessionRow = this.sessionRepo.findByTokenHash(tokenHash);
    
    if (!sessionRow) throw new Error("ERR_AUTH_003: Session invalid.");
    
    const session = new UserSessionEntity(sessionRow);
    const now = this.clock.nowIsoString();
    
    if (session.isExpired(now)) throw new Error("ERR_AUTH_003: Session expired.");
    
    // Reset expiration by 4 hours
    const durationMs = session.rememberMe ? 30 * 24 * 60 * 60 * 1000 : 4 * 60 * 60 * 1000;
    session.expiryTimestamp = new Date(new Date(now).getTime() + durationMs).toISOString();
    
    this.sessionRepo.update(session, session.rowVersion, { userId: session.userId, tenantId });
    return session.expiryTimestamp;
  }

  /**
   * Explicit session logout revocation
   */
  revokeSession(token, tenantId) {
    const tokenHash = this.passwordHasher.hash(token, "SESSION_SALT_CONST", 1);
    CacheService.getScriptCache().remove("session_actor:" + tokenHash + ":" + tenantId);
    const sessionRow = this.sessionRepo.findByTokenHash(tokenHash);
    if (sessionRow) {
      const session = new UserSessionEntity(sessionRow);
      this.sessionRepo.archive(session.sessionId, session.rowVersion, { userId: session.userId, tenantId });
    }
    return true;
  }
}
