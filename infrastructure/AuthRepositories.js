/**
 * Competition Platform Engineering Standards (CPES)
 * Authentication & RBAC Repositories Adapters
 */

class UserRepository extends BaseRepository {
  constructor() {
    super("users");
  }

  /**
   * Find user row by username and tenant ID scope
   */
  findByUsername(username, tenantId) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return null;
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    
    const userCol = headerMap["username"] - 1;
    const tenantCol = headerMap["tenantId"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row[userCol] === username && row[tenantCol] === tenantId) {
        if (row[statusCol] !== "DELETED") {
          return this.mapRowToObject(row, headerMap);
        }
      }
    }
    return null;
  }

  /**
   * Appends failed login record to login_history sheet
   */
  logFailedLogin(username, ipAddress, deviceId, timestamp) {
    try {
      const ssId = CMPE_ENVIRONMENT.getSpreadsheetId();
      const sheet = SpreadsheetApp.openById(ssId).getSheetByName("login_history");
      if (!sheet) return;
      sheet.appendRow([
        Utilities.getUuid(), // loginHistoryId
        username,
        "FAILED",
        timestamp,
        ipAddress || "UNKNOWN",
        deviceId || "UNKNOWN"
      ]);
    } catch (e) {
      Logger.log("Failed to log login history: " + e.toString());
    }
  }

  /**
   * Appends success login record to login_history sheet
   */
  logSuccessLogin(username, ipAddress, deviceId, timestamp) {
    try {
      const ssId = CMPE_ENVIRONMENT.getSpreadsheetId();
      const sheet = SpreadsheetApp.openById(ssId).getSheetByName("login_history");
      if (!sheet) return;
      sheet.appendRow([
        Utilities.getUuid(), // loginHistoryId
        username,
        "SUCCESS",
        timestamp,
        ipAddress || "UNKNOWN",
        deviceId || "UNKNOWN"
      ]);
    } catch (e) {
      Logger.log("Failed to log login history: " + e.toString());
    }
  }

  /**
   * Appends security log entry
   */
  logSecurityEvent(userId, eventType, details, ipAddress, deviceId) {
    try {
      const ssId = CMPE_ENVIRONMENT.getSpreadsheetId();
      const sheet = SpreadsheetApp.openById(ssId).getSheetByName("security_logs");
      if (!sheet) return;
      sheet.appendRow([
        Utilities.getUuid(), // securityLogId
        new Date().toISOString(),
        userId,
        eventType,
        details,
        ipAddress || "UNKNOWN",
        deviceId || "UNKNOWN"
      ]);
    } catch (e) {
      Logger.log("Failed to write security log: " + e.toString());
    }
  }
}

class SessionRepository extends BaseRepository {
  constructor() {
    super("user_sessions");
  }

  /**
   * Finds active session by token hash
   */
  findByTokenHash(tokenHash) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return null;
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    
    const tokenCol = headerMap["sessionTokenHash"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row[tokenCol] === tokenHash && row[statusCol] !== "DELETED") {
        return this.mapRowToObject(row, headerMap);
      }
    }
    return null;
  }

  /**
   * Revokes all active sessions for a user (logout all devices)
   */
  revokeAllSessionsForUser(userId) {
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
    } catch (e) {
      throw new Error("Lock contention on session revocation");
    }
    
    try {
      const sheet = this.getSheet();
      if (sheet.getLastRow() <= 1) return;
      
      const headerMap = this.getHeaderMap(sheet);
      const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
      
      const userCol = headerMap["userId"] - 1;
      const statusCol = headerMap["recordStatus"] - 1;
      
      for (let i = 0; i < data.length; i++) {
        if (data[i][userCol] === userId && data[i][statusCol] !== "DELETED") {
          const rowIdx = i + 2;
          sheet.getRange(rowIdx, statusCol + 1).setValue("DELETED");
          sheet.getRange(rowIdx, headerMap["deletedTimestamp"]).setValue(new Date().toISOString());
        }
      }
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Finds all active sessions count for a user (concurrent session check)
   */
  findActiveSessionsForUser(userId) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return [];
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    
    const userCol = headerMap["userId"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    const active = [];
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row[userCol] === userId && row[statusCol] === "ACTIVE") {
        active.push(this.mapRowToObject(row, headerMap));
      }
    }
    return active;
  }
}

class RbacRepository {
  /**
   * Fetches roles and permissions mapped to user
   */
  getUserRolesAndPermissions(userId, tenantId) {
    const ssId = CMPE_ENVIRONMENT.getSpreadsheetId();
    const ss = SpreadsheetApp.openById(ssId);
    
    const userRolesSheet = ss.getSheetByName("user_roles");
    const rolePermsSheet = ss.getSheetByName("role_permissions");
    const rolesSheet = ss.getSheetByName("roles");
    const permsSheet = ss.getSheetByName("permissions");
    
    const userRoles = [];
    const permissions = [];
    
    if (userRolesSheet && userRolesSheet.getLastRow() > 1) {
      const urData = userRolesSheet.getRange(2, 1, userRolesSheet.getLastRow() - 1, userRolesSheet.getLastColumn()).getValues();
      // user_roles headers: userRoleId, userId, roleId, scope, tenantId
      const urHeaders = userRolesSheet.getRange(1, 1, 1, userRolesSheet.getLastColumn()).getValues()[0];
      const urUserCol = urHeaders.indexOf("userId");
      const urRoleCol = urHeaders.indexOf("roleId");
      const urTenantCol = urHeaders.indexOf("tenantId");
      const urStatusCol = urHeaders.indexOf("recordStatus");
      
      const userRoleIds = [];
      urData.forEach(row => {
        if (row[urUserCol] === userId && row[urTenantCol] === tenantId && row[urStatusCol] !== "DELETED") {
          userRoleIds.push(row[urRoleCol]);
        }
      });
      
      if (userRoleIds.length > 0 && rolesSheet && rolesSheet.getLastRow() > 1) {
        const rData = rolesSheet.getRange(2, 1, rolesSheet.getLastRow() - 1, rolesSheet.getLastColumn()).getValues();
        const rHeaders = rolesSheet.getRange(1, 1, 1, rolesSheet.getLastColumn()).getValues()[0];
        const rIdCol = rHeaders.indexOf("roleId");
        const rCodeCol = rHeaders.indexOf("roleCode");
        
        rData.forEach(row => {
          if (userRoleIds.indexOf(row[rIdCol]) !== -1) {
            userRoles.push(row[rCodeCol]);
          }
        });
        
        if (rolePermsSheet && rolePermsSheet.getLastRow() > 1 && permsSheet && permsSheet.getLastRow() > 1) {
          const rpData = rolePermsSheet.getRange(2, 1, rolePermsSheet.getLastRow() - 1, rolePermsSheet.getLastColumn()).getValues();
          const rpHeaders = rolePermsSheet.getRange(1, 1, 1, rolePermsSheet.getLastColumn()).getValues()[0];
          const rpRoleIdCol = rpHeaders.indexOf("roleId");
          const rpPermIdCol = rpHeaders.indexOf("permissionId");
          const rpStatusCol = rpHeaders.indexOf("recordStatus");
          
          const userPermIds = [];
          rpData.forEach(row => {
            if (userRoleIds.indexOf(row[rpRoleIdCol]) !== -1 && row[rpStatusCol] !== "DELETED") {
              userPermIds.push(row[rpPermIdCol]);
            }
          });
          
          if (userPermIds.length > 0) {
            const pData = permsSheet.getRange(2, 1, permsSheet.getLastRow() - 1, permsSheet.getLastColumn()).getValues();
            const pHeaders = permsSheet.getRange(1, 1, 1, permsSheet.getLastColumn()).getValues()[0];
            const pIdCol = pHeaders.indexOf("permissionId");
            const pCodeCol = pHeaders.indexOf("permissionCode");
            
            pData.forEach(row => {
              if (userPermIds.indexOf(row[pIdCol]) !== -1) {
                permissions.push(row[pCodeCol]);
              }
            });
          }
        }
      }
    }
    
    const isAdministrator = userRoles.indexOf("SUPER_ADMIN") !== -1 ||
      userRoles.indexOf("TENANT_ADMIN") !== -1 ||
      userRoles.indexOf("AREA_ADMIN") !== -1;
    const effectivePermissions = isAdministrator
      ? CMPE_CONSTANTS.AllPermissions.slice()
      : Array.from(new Set(permissions));

    return {
      roles: Array.from(new Set(userRoles)),
      permissions: effectivePermissions
    };
  }
}
