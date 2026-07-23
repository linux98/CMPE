/**
 * Competition Platform Engineering Standards (CPES)
 * Main Entry Points & API Dispatcher
 */

/**
 * Serves the Single Page Application or verification endpoints
 */
function doGet(e) {
  // Maintenance routes are disabled unless a secret stored in Script Properties
  // is supplied. This prevents anonymous visitors from modifying or exporting
  // the backing database.
  if (e && e.parameter) {
    try {
      const maintenanceRequested = [
        "provision", "test", "test2", "diagnose", "repair_protections",
        "validate_protections", "seed_uat", "validate_uat", "clear_uat",
        "read_sheet"
      ].some(key => e.parameter[key]);

      if (maintenanceRequested && !isMaintenanceRequestAuthorized_(e.parameter.maintenanceToken)) {
        return jsonOutput_({
          success: false,
          error: "ERR_UNAUTHORIZED",
          message: "Maintenance endpoint is disabled or the token is invalid."
        });
      }

      if (e.parameter.provision === "1") {
        const res = executeProvisioningAndSeed();
        return jsonOutput_(res);
      }
      if (e.parameter.test === "1") {
        const res = executeStage1Tests();
        return jsonOutput_(res);
      }
      if (e.parameter.test2 === "1") {
        const res = executeStage2Tests();
        return jsonOutput_(res);
      }
      if (e.parameter.diagnose === "1") {
        const res = runSystemDiagnostics();
        return jsonOutput_(res);
      }
      if (e.parameter.repair_protections === "1") {
        const res = CMPE_SPREADSHEET_PROVISIONER.repairCanonicalSheetProtections();
        return jsonOutput_(res);
      }
      if (e.parameter.validate_protections === "1") {
        const res = CMPE_SPREADSHEET_PROVISIONER.validateCanonicalSheetProtections();
        return jsonOutput_(res);
      }
      if (e.parameter.seed_uat === "1") {
        const res = seedUatMockData();
        return jsonOutput_(res);
      }
      if (e.parameter.validate_uat === "1") {
        const res = validateUatMockData();
        return jsonOutput_(res);
      }
      if (e.parameter.clear_uat === "1") {
        const res = clearUatMockData("CLEAR_UAT_DATA");
        return jsonOutput_(res);
      }
      if (e.parameter.read_sheet) {
        if (!CMPE_CONSTANTS.TableCatalog[e.parameter.read_sheet]) {
          return jsonOutput_({ success: false, error: "Invalid sheet name" });
        }
        const ss = SpreadsheetApp.openById(CMPE_ENVIRONMENT.getSpreadsheetId());
        const sheet = ss.getSheetByName(e.parameter.read_sheet);
        if (!sheet) {
          return jsonOutput_({ success: false, error: "Sheet not found" });
        }
        const data = sheet.getDataRange().getValues();
        return jsonOutput_({
          success: true,
          headers: data[0],
          rows: data.slice(1)
        });
      }
    } catch (err) {
      return jsonOutput_({
        success: false,
        error: err.toString(),
        requestId: CMPE_UTILITIES.generateUuid()
      });
    }
  }

  var template = HtmlService.createTemplateFromFile('Index');
  
  if (e && e.parameter && e.parameter.v) {
    template.verifyId = e.parameter.v;
  } else {
    template.verifyId = "";
  }
  
  var output = template.evaluate();
  output.setTitle("ระบบจัดการแข่งขัน ก.พ.ด. ภาคอีสาน - สพม.สกลนคร");
  output.addMetaTag("viewport", "width=device-width, initial-scale=1");
  output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return output;
}

function rebuildRegistrationDisplayLookup_() {
  const spreadsheet = SpreadsheetApp.openById(CMPE_ENVIRONMENT.getSpreadsheetId());
  const readRows = sheetName => {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() <= 1) return [];
    const values = sheet.getDataRange().getValues();
    const headers = values[0].map(String);
    const statusIndex = headers.indexOf("recordStatus");
    return values.slice(1).filter(row =>
      statusIndex < 0 || row[statusIndex] !== "DELETED"
    ).map(row => headers.reduce((object, header, index) => {
      if (header) object[header] = row[index];
      return object;
    }, {}));
  };
  const toMap = (rows, idField, valueFactory) => rows.reduce((map, row) => {
    if (row[idField]) map[row[idField]] = valueFactory(row);
    return map;
  }, {});
  const lookup = {
    configs: toMap(readRows("competition_category_configs"), "competitionCategoryConfigId",
      row => [row.categoryId || "", row.educationLevelId || ""]),
    categories: toMap(readRows("competition_categories"), "categoryId",
      row => row.nameTh || row.nameEn || ""),
    competitions: toMap(readRows("competitions"), "competitionId",
      row => row.nameTh || row.nameEn || ""),
    schools: toMap(readRows("schools"), "schoolId",
      row => row.nameTh || row.nameEn || ""),
    levels: toMap(readRows("education_levels"), "educationLevelId",
      row => row.nameTh || row.nameEn || "")
  };
  const properties = PropertiesService.getScriptProperties();
  properties.setProperties({
    REG_DISPLAY_CONFIGS: JSON.stringify(lookup.configs),
    REG_DISPLAY_CATEGORIES: JSON.stringify(lookup.categories),
    REG_DISPLAY_COMPETITIONS: JSON.stringify(lookup.competitions),
    REG_DISPLAY_SCHOOLS: JSON.stringify(lookup.schools),
    REG_DISPLAY_LEVELS: JSON.stringify(lookup.levels),
    REG_DISPLAY_BUILT_AT: new Date().toISOString()
  }, false);
  return {
    success: true,
    builtAt: properties.getProperty("REG_DISPLAY_BUILT_AT"),
    counts: {
      configs: Object.keys(lookup.configs).length,
      categories: Object.keys(lookup.categories).length,
      competitions: Object.keys(lookup.competitions).length,
      schools: Object.keys(lookup.schools).length,
      levels: Object.keys(lookup.levels).length
    }
  };
}

function rebuildRegistrationDisplayLookup() {
  return rebuildRegistrationDisplayLookup_();
}

function getRegistrationDisplayLookup_() {
  const properties = PropertiesService.getScriptProperties();
  const parse = key => {
    try {
      return JSON.parse(properties.getProperty(key) || "{}");
    } catch (error) {
      return {};
    }
  };
  const defaultConfigs = {};
  ["EVT-2569-AREA", "EVT-2569-CLUSTER", "EVT-2568-HISTORY"].forEach(eventId => {
    [1, 2, 3, 4].forEach(itemNumber => {
      defaultConfigs[`CONFIG-${eventId}-${itemNumber}`] = [
        itemNumber <= 3 ? "CAT-1" : "CAT-2",
        "LVL-SEC"
      ];
    });
  });
  const defaultSchools = {
    "SCH-SAKON-1": "โรงเรียนสกลนครพัฒนศึกษา",
    "SCH-SAKON-2": "โรงเรียนธาตุนารายณ์วิทยา",
    "SCH-SAKON-3": "โรงเรียนพังโคนวิทยาคม",
    "SCH-SAKON-4": "โรงเรียนวานรนิวาสศึกษา",
    "SCH-SAKON-5": "โรงเรียนสว่างแดนดินวิทยา",
    "SCH-SAKON-6": "โรงเรียนกุสุมาลย์พิทยาคม",
    "SCH-SAKON-7": "โรงเรียนคำตากล้าราชประชาสงเคราะห์",
    "SCH-SAKON-8": "โรงเรียนอากาศอำนวยศึกษา",
    "SCH-SAKON-9": "โรงเรียนพรรณานิคมพิทยาคม",
    "SCH-SAKON-10": "โรงเรียนเต่างอยพัฒนศึกษา",
    "SCH-SAKON-11": "โรงเรียนโคกศรีวิทยาคม",
    "SCH-SAKON-12": "โรงเรียนนิคมน้ำอูนศึกษา",
    "SCH-SAKON-13": "โรงเรียนเจริญศิลป์พิทยาคม",
    "SCH-SAKON-14": "โรงเรียนภูพานวิทยา",
    "SCH-SAKON-15": "โรงเรียนโพนนาแก้วศึกษา"
  };
  return {
    configs: Object.assign(defaultConfigs, parse("REG_DISPLAY_CONFIGS")),
    categories: Object.assign({
      "CAT-1": "ภาษาไทย",
      "CAT-2": "คณิตศาสตร์"
    }, parse("REG_DISPLAY_CATEGORIES")),
    competitions: Object.assign({
      "EVT-2569-AREA": "งานศิลปหัตถกรรมนักเรียน ระดับเขตพื้นที่การศึกษา ปีการศึกษา 2569",
      "EVT-2569-CLUSTER": "การแข่งขันทักษะวิชาการระดับสหวิทยาเขต ปีการศึกษา 2569",
      "EVT-2568-HISTORY": "งานแข่งขันทักษะวิชาการ ปีการศึกษา 2568 (ประวัติย้อนหลัง)"
    }, parse("REG_DISPLAY_COMPETITIONS")),
    schools: Object.assign(defaultSchools, parse("REG_DISPLAY_SCHOOLS")),
    levels: Object.assign({
      "LVL-SEC": "ระดับมัธยมศึกษา"
    }, parse("REG_DISPLAY_LEVELS")),
    builtAt: properties.getProperty("REG_DISPLAY_BUILT_AT") || ""
  };
}

function jsonOutput_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function isMaintenanceRequestAuthorized_(providedToken) {
  const configuredToken = PropertiesService.getScriptProperties()
    .getProperty("MAINTENANCE_TOKEN");
  if (!configuredToken || !providedToken) return false;
  return CMPE_UTILITIES.constantTimeCompare(String(configuredToken), String(providedToken));
}

/**
 * Helper to include files in HTML template
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Dependency Injector Helpers
 */
function getAuthService() {
  const userRepo = new UserRepository();
  const sessionRepo = new SessionRepository();
  const hasher = new PasswordHasher();
  const clock = {
    nowIsoString: () => new Date().toISOString(),
    nowEpochMs: () => Date.now()
  };
  return new AuthDomainService(userRepo, sessionRepo, hasher, clock);
}

function getSessionManager() {
  const sessionRepo = new SessionRepository();
  const userRepo = new UserRepository();
  const rbacRepo = new RbacRepository();
  const hasher = new PasswordHasher();
  const clock = {
    nowIsoString: () => new Date().toISOString(),
    nowEpochMs: () => Date.now()
  };
  return new SessionManager(sessionRepo, userRepo, rbacRepo, hasher, clock);
}

/**
 * Helper to fetch last 3 password hashes for reuse prevention checks
 */
function getPasswordHistoryList(userId) {
  const repo = new BaseRepository("password_history");
  const sheet = repo.getSheet();
  if (sheet.getLastRow() <= 1) return [];
  const headerMap = repo.getHeaderMap(sheet);
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  const userCol = headerMap["userId"] - 1;
  const hashCol = headerMap["passwordHash"] - 1;
  const timeCol = headerMap["changedTimestamp"] - 1;
  
  const history = [];
  data.forEach(row => {
    if (row[userCol] === userId) {
      history.push({
        hash: row[hashCol],
        timestamp: row[timeCol]
      });
    }
  });
  history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return history.slice(0, 3);
}

/**
 * Helper to log password changes into history sheet
 */
function passwordReuseFingerprint_(password) {
  const props = PropertiesService.getScriptProperties();
  let pepper = props.getProperty("PASSWORD_HISTORY_PEPPER");
  if (!pepper) {
    pepper = CMPE_UTILITIES.generateUuid() + CMPE_UTILITIES.generateUuid();
    props.setProperty("PASSWORD_HISTORY_PEPPER", pepper);
  }
  return CMPE_UTILITIES.hashPassword(String(password), pepper, 5000);
}

function writePasswordHistoryEntry(userId, password) {
  const repo = new BaseRepository("password_history");
  repo.create({
    passwordHistoryId: CMPE_UTILITIES.generateUuid(),
    userId: userId,
    passwordHash: passwordReuseFingerprint_(password),
    changedTimestamp: new Date().toISOString()
  }, { userId: userId, tenantId: "" });
}

function assertNoActiveReferences_(sheetName, fieldName, value, tenantId, label) {
  const records = new BaseRepository(sheetName).findAll(tenantId);
  if (records.some(function(item) { return item[fieldName] === value; })) {
    throw new Error("ERR_REFERENCE_IN_USE: " + label + " is referenced by active records.");
  }
}

function getCatalogRevision_() {
  const properties = PropertiesService.getScriptProperties();
  return properties.getProperty("CATALOG_CACHE_REVISION") || "1";
}

function invalidateCatalogCache_() {
  PropertiesService.getScriptProperties().setProperty(
    "CATALOG_CACHE_REVISION",
    String(Date.now())
  );
}

function cachedCatalogRead_(namespace, tenantId, builder, ttlSeconds) {
  const revision = getCatalogRevision_();
  const digest = Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      revision + ":" + tenantId + ":" + namespace,
      Utilities.Charset.UTF_8
    )
  ).slice(0, 36);
  const key = "catalog:" + digest;
  const cache = CacheService.getScriptCache();
  const cached = cache.get(key);
  if (cached) return JSON.parse(cached);
  const value = CMPE_UTILITIES.toJsonSafe(builder());
  const serialized = JSON.stringify(value);
  // Script cache values are limited to 100 KB. Large responses bypass cache.
  if (serialized.length < 90000) cache.put(key, serialized, ttlSeconds || 120);
  return value;
}

/**
 * Universal API Dispatcher (Section 13: API Contract)
 * Handles all incoming browser client API execution requests.
 */
function apiDispatcher(requestEnvelope) {
  resetCmpeDbRequestContext_();
  requestEnvelope = requestEnvelope || {};
  const reqId = requestEnvelope.requestId || CMPE_UTILITIES.generateUuid();
  const clientInfo = requestEnvelope.client || {};
  const ipAddress = clientInfo.ipAddress || "UNKNOWN";
  const deviceId = clientInfo.deviceId || "UNKNOWN";
  
  try {
    const action = requestEnvelope.action;
    const payload = requestEnvelope.payload || {};
    const sessionToken = requestEnvelope.sessionToken || "";
    const tenantId = payload.tenantId || requestEnvelope.tenantId ||
      CMPE_ENVIRONMENT.getDefaultTenantId();
    
    if (!action) {
      return CMPE_UTILITIES.errorEnvelope("ERR_INVALID_ACTION", "Missing target action API.", [], reqId);
    }

    const isReadAction = action.endsWith(".list") ||
      action.endsWith(".get") ||
      action.endsWith(".preview") ||
      action.endsWith(".validateReadiness") ||
      action.startsWith("auth.");
    if (!isReadAction) invalidateCatalogCache_();
    
    // Public certificate verification is intentionally read-only.
    if (action === "certificate.verify") {
      const token = String(payload.verificationToken || "").trim();
      if (!token) {
        return CMPE_UTILITIES.errorEnvelope(
          "ERR_BAD_REQUEST",
          "Verification token is required.",
          [],
          reqId
        );
      }
      const result = new CertificateVerificationService(
        new CertificateVerificationRepository(),
        new CertificateRepository()
      ).verifyPublicToken(token);
      return CMPE_UTILITIES.successEnvelope(result, reqId);
    }

    // Maintenance actions require an authenticated administrator plus a
    // separate secret configured in Script Properties.
    if (action.startsWith("system.")) {
      const actor = getSessionManager().verifySession(sessionToken, tenantId);
      const isAdmin = actor.roles.indexOf("SUPER_ADMIN") !== -1 ||
        actor.roles.indexOf("TENANT_ADMIN") !== -1 ||
        actor.roles.indexOf("AREA_ADMIN") !== -1;
      if (!isAdmin || !isMaintenanceRequestAuthorized_(payload.maintenanceToken)) {
        return CMPE_UTILITIES.errorEnvelope(
          "ERR_UNAUTHORIZED",
          "Administrator session and maintenance token are required.",
          [],
          reqId
        );
      }
      if (action === "system.provision") {
        return CMPE_UTILITIES.successEnvelope(executeProvisioningAndSeed(), reqId);
      } else if (action === "system.diagnose") {
        return CMPE_UTILITIES.successEnvelope(runSystemDiagnostics(), reqId);
      } else if (action === "system.test") {
        return CMPE_UTILITIES.successEnvelope(executeStage1Tests(), reqId);
      } else if (action === "system.test2") {
        return CMPE_UTILITIES.successEnvelope(executeStage2Tests(), reqId);
      }
    }
    
    // --- AUTHENTICATION API METHODS ---
    
    // 1. auth.login
    if (action === "auth.login") {
      const username = (payload.username || "").trim();
      const password = payload.password || "";
      const rememberMe = payload.rememberMe === true;
      
      if (!username || !password) {
        return CMPE_UTILITIES.errorEnvelope("ERR_AUTH_001", "Username and password are required.", [], reqId);
      }
      
      const authService = getAuthService();
      const sessionMgr = getSessionManager();
      
      // Perform authentication
      const user = authService.authenticate(username, password, tenantId, deviceId, ipAddress);
      
      // Create session
      const sessionInfo = sessionMgr.createSession(user.userId, tenantId, deviceId, ipAddress, rememberMe);
      
      // Fetch user RBAC profile
      const rbacRepo = new RbacRepository();
      const rbac = rbacRepo.getUserRolesAndPermissions(user.userId, tenantId);
      
      return CMPE_UTILITIES.successEnvelope({
        sessionToken: sessionInfo.rawToken,
        expiryTimestamp: sessionInfo.expiryTimestamp,
        user: {
          userId: user.userId,
          username: user.username,
          tenantId: user.tenantId,
          roles: rbac.roles,
          permissions: rbac.permissions
        }
      }, reqId);
    }
    
    // 2. auth.logout
    if (action === "auth.logout") {
      const sessionMgr = getSessionManager();
      sessionMgr.revokeSession(sessionToken, tenantId);
      return CMPE_UTILITIES.successEnvelope({ success: true }, reqId);
    }
    
    // 3. auth.refresh
    if (action === "auth.refresh") {
      const sessionMgr = getSessionManager();
      const newExpiry = sessionMgr.renewSession(sessionToken, tenantId);
      return CMPE_UTILITIES.successEnvelope({ expiryTimestamp: newExpiry }, reqId);
    }
    
    // 4. auth.me
    if (action === "auth.me") {
      const sessionMgr = getSessionManager();
      const sessionContext = sessionMgr.verifySession(sessionToken, tenantId);
      return CMPE_UTILITIES.successEnvelope(sessionContext, reqId);
    }
    
    // 5. auth.validate
    if (action === "auth.validate") {
      const requiredPerm = payload.permissionCode || "";
      const sessionMgr = getSessionManager();
      const sessionContext = sessionMgr.verifySession(sessionToken, tenantId);
      const isAllowed = sessionContext.permissions.indexOf(requiredPerm) !== -1;
      return CMPE_UTILITIES.successEnvelope({ allowed: isAllowed }, reqId);
    }
    
    // 6. auth.changePassword
    if (action === "auth.changePassword") {
      const oldPassword = payload.oldPassword || "";
      const newPassword = payload.newPassword || "";
      
      if (!oldPassword || !newPassword) {
        return CMPE_UTILITIES.errorEnvelope("ERR_BAD_REQUEST", "Old and new passwords are required.", [], reqId);
      }
      
      const sessionMgr = getSessionManager();
      const sessionContext = sessionMgr.verifySession(sessionToken, tenantId);
      
      const userRepo = new UserRepository();
      const userRow = userRepo.findById(sessionContext.userId, tenantId);
      if (!userRow) return CMPE_UTILITIES.errorEnvelope("ERR_USER_NOT_FOUND", "User not found.", [], reqId);
      
      const user = new UserEntity(userRow);
      const hasher = new PasswordHasher();
      
      // Verify old password
      const oldHash = hasher.hash(oldPassword, user.salt, user.iterations);
      if (!hasher.constantTimeCompare(oldHash, user.passwordHash)) {
        return CMPE_UTILITIES.errorEnvelope("ERR_AUTH_001", "Incorrect current password.", [], reqId);
      }
      
      // Password reuse restrictions check (cannot reuse last 3 passwords)
      const history = getPasswordHistoryList(user.userId);
      const newPasswordFingerprint = passwordReuseFingerprint_(newPassword);
      const isReused = history.some(h => {
        return hasher.constantTimeCompare(h.hash, newPasswordFingerprint);
      });
      if (isReused) {
        return CMPE_UTILITIES.errorEnvelope("ERR_PASSWORD_REUSE", "Cannot reuse any of the last 3 passwords.", [], reqId);
      }
      
      // Perform updates
      const newSalt = hasher.generateSalt();
      const newHash = hasher.hash(newPassword, newSalt, user.iterations);
      
      user.passwordHash = newHash;
      user.salt = newSalt;
      
      userRepo.update(user, user.rowVersion, { userId: user.userId, tenantId });
      writePasswordHistoryEntry(user.userId, newPassword);
      
      return CMPE_UTILITIES.successEnvelope({ success: true }, reqId);
    }
    
    // 7. auth.resetPassword
    if (action === "auth.resetPassword") {
      const targetUserId = payload.userId || "";
      const newPassword = payload.newPassword || "";
      
      if (!targetUserId || !newPassword) {
        return CMPE_UTILITIES.errorEnvelope("ERR_BAD_REQUEST", "Target User ID and new password are required.", [], reqId);
      }
      
      // Validate administrative session permission
      const sessionMgr = getSessionManager();
      const sessionContext = sessionMgr.verifySession(sessionToken, tenantId);
      
      if (sessionContext.permissions.indexOf(CMPE_CONSTANTS.Permissions.SETTINGS_UPDATE) === -1) {
        return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Only administrators can reset passwords.", [], reqId);
      }
      
      const userRepo = new UserRepository();
      const targetUserRow = userRepo.findById(targetUserId, tenantId);
      if (!targetUserRow) return CMPE_UTILITIES.errorEnvelope("ERR_USER_NOT_FOUND", "Target user not found.", [], reqId);
      
      const targetUser = new UserEntity(targetUserRow);
      const hasher = new PasswordHasher();
      
      const newSalt = hasher.generateSalt();
      const newHash = hasher.hash(newPassword, newSalt, targetUser.iterations);
      
      targetUser.passwordHash = newHash;
      targetUser.salt = newSalt;
      targetUser.failedLoginCount = 0;
      targetUser.status = "ACTIVE";
      targetUser.lockoutUntil = "";
      
      userRepo.update(targetUser, targetUser.rowVersion, { userId: sessionContext.userId, tenantId });
      writePasswordHistoryEntry(targetUser.userId, newPassword);
      
      return CMPE_UTILITIES.successEnvelope({ success: true }, reqId);
    }
    
    // --- MASTER DATA API METHODS (Stage 3) ---
    if (action.startsWith("master.")) {
      const sessionMgr = getSessionManager();
      const actor = sessionMgr.verifySession(sessionToken, tenantId);
      
      // Enforce specific action permissions
      if (action === "master.tenants.list") {
        const repo = new TenantRepository();
        const tenants = cachedCatalogRead_("master.tenants.list", "GLOBAL", function() {
          return repo.findAll().map(function(t) {
          return {
            tenantId: t.tenantId,
            name: t.name,
            province: t.province,
            adminUsername: t.adminUsername,
            status: t.status,
            rowVersion: t.rowVersion,
            recordStatus: t.recordStatus
          };
          });
        }, 120);
        return CMPE_UTILITIES.successEnvelope(tenants, reqId);
      }
      if (action === "master.tenants.create") {
        if (actor.permissions.indexOf("tenant.create") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing tenant.create permission", [], reqId);
        }
        const svc = new TenantService(new TenantRepository());
        const tenant = svc.createTenant(payload, actor);
        return CMPE_UTILITIES.successEnvelope({
          tenantId: tenant.tenantId, name: tenant.name, province: tenant.province,
          adminUsername: tenant.adminUsername, status: tenant.status,
          rowVersion: tenant.rowVersion
        }, reqId);
      }
      if (action === "master.tenants.update") {
        if (actor.permissions.indexOf("tenant.update") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing tenant.update permission", [], reqId);
        }
        const svc = new TenantService(new TenantRepository());
        const tenant = svc.updateTenant(payload, payload.rowVersion, actor);
        return CMPE_UTILITIES.successEnvelope({
          tenantId: tenant.tenantId, name: tenant.name, province: tenant.province,
          adminUsername: tenant.adminUsername, status: tenant.status,
          rowVersion: tenant.rowVersion
        }, reqId);
      }
      if (action === "master.tenants.transition") {
        if (actor.permissions.indexOf("tenant.transition") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing tenant.transition permission", [], reqId);
        }
        const svc = new TenantService(new TenantRepository());
        const tenant = svc.transitionStatus(
          payload.tenantId,
          payload.status,
          payload.rowVersion,
          actor
        );
        return CMPE_UTILITIES.successEnvelope({
          tenantId: tenant.tenantId, name: tenant.name, province: tenant.province,
          adminUsername: tenant.adminUsername, status: tenant.status,
          rowVersion: tenant.rowVersion
        }, reqId);
      }
      if (action === "master.academicYears.list") {
        const repo = new AcademicYearRepository();
        return CMPE_UTILITIES.successEnvelope(
          cachedCatalogRead_("master.academicYears.list", tenantId, function() {
            return repo.findAll();
          }, 120),
          reqId
        );
      }
      if (action === "master.academicYears.create") {
        if (actor.permissions.indexOf("system.settings.update") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing system.settings.update permission", [], reqId);
        }
        const created = new AcademicYearService(new AcademicYearRepository()).createYear(payload, actor);
        return CMPE_UTILITIES.successEnvelope(created, reqId);
      }
      if (action === "master.academicYears.update") {
        if (actor.permissions.indexOf("system.settings.update") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing system.settings.update permission", [], reqId);
        }
        const updated = new AcademicYearService(new AcademicYearRepository()).updateYear(payload, payload.rowVersion, actor);
        return CMPE_UTILITIES.successEnvelope(updated, reqId);
      }
      if (action === "master.academicYears.archive") {
        if (actor.permissions.indexOf("system.settings.update") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing system.settings.update permission", [], reqId);
        }
        assertNoActiveReferences_("competitions", "academicYearId", payload.academicYearId, tenantId, "Academic year");
        return CMPE_UTILITIES.successEnvelope(
          new AcademicYearRepository().archive(payload.academicYearId, payload.rowVersion, actor),
          reqId
        );
      }
      if (action === "master.academicYears.setCurrent") {
        if (actor.permissions.indexOf("academicYear.setCurrent") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing academicYear.setCurrent permission", [], reqId);
        }
        const svc = new AcademicYearService(new AcademicYearRepository());
        svc.setCurrentYear(payload.academicYearId, actor);
        return CMPE_UTILITIES.successEnvelope({ success: true }, reqId);
      }
      if (action === "master.provinces.list") {
        const repo = new ProvinceRepository();
        return CMPE_UTILITIES.successEnvelope(repo.findAll(), reqId);
      }
      if (action === "master.districts.list") {
        const repo = new DistrictRepository();
        const provId = payload.provinceId;
        const list = provId ? repo.findByProvince(provId) : [];
        return CMPE_UTILITIES.successEnvelope(list, reqId);
      }
      if (action === "master.schools.list") {
        const repo = new SchoolRepository();
        const allSchools = cachedCatalogRead_("master.schools.list", tenantId, function() {
          return repo.findByTenant(tenantId);
        }, 120);
        const query = String(payload.query || "").trim().toLowerCase();
        const list = query ? allSchools.filter(function(s) {
          return [s.nameTh, s.nameEn, s.schoolId].join(" ").toLowerCase().indexOf(query) !== -1;
        }) : allSchools;
        return CMPE_UTILITIES.successEnvelope(list, reqId);
      }
      if (action === "master.schools.create") {
        if (actor.permissions.indexOf("school.create") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing school.create permission", [], reqId);
        }
        const svc = new SchoolService(new SchoolRepository(), new DistrictRepository());
        const school = svc.createSchool(payload, actor);
        return CMPE_UTILITIES.successEnvelope(school, reqId);
      }
      if (action === "master.schools.update") {
        if (actor.permissions.indexOf("school.create") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing school management permission", [], reqId);
        }
        const updated = new SchoolService(new SchoolRepository(), new DistrictRepository())
          .updateSchool(payload, payload.rowVersion, actor);
        return CMPE_UTILITIES.successEnvelope(updated, reqId);
      }
      if (action === "master.schools.archive") {
        if (actor.permissions.indexOf("school.create") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing school management permission", [], reqId);
        }
        assertNoActiveReferences_("registrations", "schoolId", payload.schoolId, tenantId, "School");
        return CMPE_UTILITIES.successEnvelope(
          new SchoolRepository().archive(payload.schoolId, payload.rowVersion, actor),
          reqId
        );
      }
      if (action === "master.schools.import") {
        if (actor.permissions.indexOf("school.import") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing school.import permission", [], reqId);
        }
        const svc = new SchoolService(new SchoolRepository(), new DistrictRepository());
        const result = svc.importSchoolsCsv(payload.csvContent, payload.atomic !== false, actor);
        return CMPE_UTILITIES.successEnvelope(result, reqId);
      }
      if (action === "master.schools.downloadImportTemplate") {
        const template = "schoolCode,nameTh,nameEn,districtId,latitude,longitude,email,phone\n" +
                         "1047150101,โรงเรียนทดสอบ 1,Test School 1,DIST_1001,15.1234,102.1234,test1@school.go.th,042123456";
        return CMPE_UTILITIES.successEnvelope({ templateCsv: template }, reqId);
      }
      if (action === "master.educationLevels.list") {
        const repo = new EducationLevelRepository();
        return CMPE_UTILITIES.successEnvelope(
          cachedCatalogRead_("master.educationLevels.list", tenantId, function() {
            return repo.findAll();
          }, 120),
          reqId
        );
      }
      if (action === "master.educationLevels.create") {
        if (actor.permissions.indexOf("system.settings.update") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing system.settings.update permission", [], reqId);
        }
        const created = new EducationLevelService(new EducationLevelRepository()).createLevel(payload, actor);
        return CMPE_UTILITIES.successEnvelope(created, reqId);
      }
      if (action === "master.educationLevels.update") {
        if (actor.permissions.indexOf("system.settings.update") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing system.settings.update permission", [], reqId);
        }
        const updated = new EducationLevelRepository().update(
          new EducationLevelEntity(payload), payload.rowVersion, actor
        );
        return CMPE_UTILITIES.successEnvelope(updated, reqId);
      }
      if (action === "master.educationLevels.archive") {
        if (actor.permissions.indexOf("system.settings.update") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing system.settings.update permission", [], reqId);
        }
        assertNoActiveReferences_("competition_category_configs", "educationLevelId", payload.educationLevelId, tenantId, "Education level");
        return CMPE_UTILITIES.successEnvelope(
          new EducationLevelRepository().archive(payload.educationLevelId, payload.rowVersion, actor),
          reqId
        );
      }
      if (action === "master.competitionTypes.list") {
        const repo = new CompetitionTypeRepository();
        const types = cachedCatalogRead_("master.competitionTypes.list", tenantId, function() {
          return repo.findAll();
        }, 120);
        return CMPE_UTILITIES.successEnvelope(types.length ? types : [{
          competitionTypeId: "TYPE_GENERAL",
          typeCode: "GENERAL",
          nameTh: "การแข่งขันทักษะวิชาการทั่วไป",
          nameEn: "General Academic Competition",
          status: "ACTIVE",
          rowVersion: 1,
          virtualDefault: true
        }], reqId);
      }
      if (action === "master.categories.list") {
        const repo = new CompetitionCategoryRepository();
        return CMPE_UTILITIES.successEnvelope(
          cachedCatalogRead_("master.categories.list", tenantId, function() {
            return repo.findByTenant(tenantId);
          }, 120),
          reqId
        );
      }
      if (action === "master.categories.create") {
        if (actor.permissions.indexOf("competitionCategory.manage") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing competitionCategory.manage permission", [], reqId);
        }
        const svc = new CompetitionCategoryService(new CompetitionCategoryRepository(), new CompetitionTypeRepository(), new EducationLevelRepository());
        const cat = svc.createCategory(payload, actor);
        return CMPE_UTILITIES.successEnvelope(cat, reqId);
      }
      if (action === "master.categories.update") {
        if (actor.permissions.indexOf("competitionCategory.manage") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing competitionCategory.manage permission", [], reqId);
        }
        const updated = new CompetitionCategoryRepository().update(
          new CompetitionCategoryEntity(payload), payload.rowVersion, actor
        );
        return CMPE_UTILITIES.successEnvelope(updated, reqId);
      }
      if (action === "master.categories.archive") {
        if (actor.permissions.indexOf("competitionCategory.manage") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing competitionCategory.manage permission", [], reqId);
        }
        assertNoActiveReferences_("competition_category_configs", "categoryId", payload.categoryId, tenantId, "Competition category");
        return CMPE_UTILITIES.successEnvelope(
          new CompetitionCategoryRepository().archive(payload.categoryId, payload.rowVersion, actor),
          reqId
        );
      }
      if (action === "master.venues.list") {
        const repo = new VenueRepository();
        return CMPE_UTILITIES.successEnvelope(
          cachedCatalogRead_("master.venues.list", tenantId, function() {
            return repo.findByTenant(tenantId);
          }, 120),
          reqId
        );
      }
      if (action === "master.venues.create") {
        if (actor.permissions.indexOf("venue.manage") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing venue.manage permission", [], reqId);
        }
        const svc = new VenueService(new VenueRepository(), new SchoolRepository(), new DistrictRepository());
        const venue = svc.createVenue(payload, actor);
        return CMPE_UTILITIES.successEnvelope(venue, reqId);
      }
      if (action === "master.venues.update") {
        if (actor.permissions.indexOf("venue.manage") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing venue.manage permission", [], reqId);
        }
        const updated = new VenueRepository().update(
          new VenueEntity(payload), payload.rowVersion, actor
        );
        return CMPE_UTILITIES.successEnvelope(updated, reqId);
      }
      if (action === "master.venues.archive") {
        if (actor.permissions.indexOf("venue.manage") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing venue.manage permission", [], reqId);
        }
        assertNoActiveReferences_("competition_rooms", "venueId", payload.venueId, tenantId, "Venue");
        return CMPE_UTILITIES.successEnvelope(
          new VenueRepository().archive(payload.venueId, payload.rowVersion, actor),
          reqId
        );
      }
    }

    // --- COMPETITION CONFIGURATION API METHODS (Stage 4) ---
    if (action.startsWith("competition.") || action.startsWith("configuration.")) {
      const sessionMgr = getSessionManager();
      const actor = sessionMgr.verifySession(sessionToken, tenantId);
      
      // DI Helpers for config services
      const compRepo = new CompetitionRepository();
      const roundRepo = new CompetitionRoundRepository();
      const catConfigRepo = new CompetitionCategoryConfigRepository();
      const ruleRepo = new CategoryRuleRepository();
      const scoreTempRepo = new ScoreTemplateRepository();
      const criteriaRepo = new ScoreCriterionRepository();
      const windowRepo = new RegistrationWindowRepository();
      
      const readinessSvc = new ConfigurationReadinessService(roundRepo, catConfigRepo, ruleRepo, windowRepo);
      const lifecycleSvc = new CompetitionLifecycleService(compRepo, readinessSvc);
      const appSvc = new CompetitionApplicationService(compRepo, roundRepo, catConfigRepo, ruleRepo, scoreTempRepo, criteriaRepo, windowRepo);
      
      // 1. competition.* endpoints
      if (action === "competition.list") {
        const canonicalCompetitions = cachedCatalogRead_("competition.list", tenantId, function() {
          return compRepo.findByTenant(tenantId).filter(function(item) {
            return /^AY[-_]/.test(String(item.academicYearId || "")) &&
              Boolean(item.competitionCode) &&
              Boolean(item.nameTh);
          });
        }, 120);
        return CMPE_UTILITIES.successEnvelope(canonicalCompetitions, reqId);
      }
      if (action === "competition.workspace.get") {
        const competition = compRepo.findById(payload.competitionId, tenantId);
        if (!competition) {
          return CMPE_UTILITIES.errorEnvelope(
            "ERR_COMP_NOT_FOUND",
            "Competition was not found in this tenant.",
            [],
            reqId
          );
        }
        const rounds = roundRepo.findByCompetition(payload.competitionId);
        const categoryConfigs = catConfigRepo.findByCompetition(payload.competitionId);
        const registrationWindows = windowRepo.findByCompetition(payload.competitionId);
        const readiness = readinessSvc.checkReadiness(payload.competitionId, actor);
        const categories = new CompetitionCategoryRepository().findByTenant(tenantId);
        const levels = new EducationLevelRepository().findAll();
        const categoryMap = {};
        const levelMap = {};
        categories.forEach(function(item) {
          categoryMap[item.categoryId] = item.nameTh || item.nameEn || item.categoryCode;
        });
        levels.forEach(function(item) {
          levelMap[item.educationLevelId] = item.nameTh || item.nameEn || item.levelCode;
        });
        return CMPE_UTILITIES.successEnvelope({
          competition: competition,
          rounds: rounds,
          categoryConfigs: categoryConfigs,
          registrationWindows: registrationWindows,
          readiness: readiness,
          lookups: { categories: categoryMap, levels: levelMap }
        }, reqId);
      }
      if (action === "competition.create") {
        if (actor.permissions.indexOf("competition.create") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing competition.create permission", [], reqId);
        }
        if (payload.competitionTypeId === "TYPE_GENERAL" &&
            !new CompetitionTypeRepository().findById("TYPE_GENERAL", tenantId)) {
          new CompetitionTypeRepository().create(new CompetitionTypeEntity({
            competitionTypeId: "TYPE_GENERAL",
            typeCode: "GENERAL",
            nameTh: "การแข่งขันทักษะวิชาการทั่วไป",
            nameEn: "General Academic Competition",
            status: "ACTIVE"
          }), actor);
        }
        const comp = appSvc.createCompetition(payload, actor);
        return CMPE_UTILITIES.successEnvelope(comp, reqId);
      }
      if (action === "competition.update") {
        if (actor.permissions.indexOf("competition.update") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing competition.update permission", [], reqId);
        }
        const comp = appSvc.updateCompetition(payload, payload.rowVersion, actor);
        return CMPE_UTILITIES.successEnvelope(comp, reqId);
      }
      if (action === "competition.clone") {
        if (actor.permissions.indexOf("competition.clone") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing competition.clone permission", [], reqId);
        }
        const clone = appSvc.cloneCompetition(payload.competitionId, payload.nameTh, payload.nameEn, actor);
        return CMPE_UTILITIES.successEnvelope(clone, reqId);
      }
      if (action === "competition.validateReadiness") {
        const readiness = readinessSvc.checkReadiness(payload.competitionId, actor);
        return CMPE_UTILITIES.successEnvelope(readiness, reqId);
      }
      if (action === "competition.transition") {
        if (actor.permissions.indexOf("competition.transition") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing competition.transition permission", [], reqId);
        }
        const comp = lifecycleSvc.transitionStatus(payload.competitionId, payload.nextState, payload.rowVersion, actor);
        return CMPE_UTILITIES.successEnvelope(comp, reqId);
      }
      
      // 2. competition.rounds.* endpoints
      if (action === "competition.rounds.list") {
        return CMPE_UTILITIES.successEnvelope(roundRepo.findByCompetition(payload.competitionId), reqId);
      }
      if (action === "competition.rounds.create") {
        if (actor.permissions.indexOf("competitionRound.manage") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing competitionRound.manage permission", [], reqId);
        }
        const round = new CompetitionRoundEntity(payload);
        round.competitionRoundId =
          payload.competitionRoundId || payload.roundId || CMPE_UTILITIES.generateUuid();
        const created = roundRepo.create(round, actor);
        return CMPE_UTILITIES.successEnvelope(created, reqId);
      }
      
      // 3. competition.categories.* endpoints
      if (action === "competition.categories.list") {
        return CMPE_UTILITIES.successEnvelope(catConfigRepo.findByCompetition(payload.competitionId), reqId);
      }
      if (action === "competition.categories.add") {
        if (actor.permissions.indexOf("competitionCategoryConfig.manage") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing competitionCategoryConfig.manage permission", [], reqId);
        }
        const config = new CompetitionCategoryConfigEntity(payload);
        config.competitionCategoryConfigId =
          payload.competitionCategoryConfigId || payload.configId || CMPE_UTILITIES.generateUuid();
        const created = catConfigRepo.create(config, actor);
        return CMPE_UTILITIES.successEnvelope(created, reqId);
      }
      
      // 4. configuration.rules.* endpoints
      if (action === "configuration.rules.list") {
        return CMPE_UTILITIES.successEnvelope(ruleRepo.findByConfig(payload.competitionCategoryConfigId), reqId);
      }
      if (action === "configuration.rules.create") {
        if (actor.permissions.indexOf("categoryRule.manage") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing categoryRule.manage permission", [], reqId);
        }
        const svc = new DynamicRuleApplicationService(ruleRepo);
        const rule = svc.createRule(payload, actor);
        return CMPE_UTILITIES.successEnvelope(rule, reqId);
      }
      if (action === "configuration.rules.preview") {
        const svc = new DynamicRuleApplicationService(ruleRepo);
        const result = svc.previewRuleEvaluation(payload.rulesJson, payload.context);
        return CMPE_UTILITIES.successEnvelope(result, reqId);
      }
      
      // 5. configuration.scoreTemplates.* endpoints
      if (action === "configuration.scoreTemplates.list") {
        return CMPE_UTILITIES.successEnvelope(scoreTempRepo.findByTenant(tenantId), reqId);
      }
      if (action === "configuration.scoreTemplates.create") {
        if (actor.permissions.indexOf("scoreTemplate.manage") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing scoreTemplate.manage permission", [], reqId);
        }
        const svc = new ScoreTemplateApplicationService(scoreTempRepo, criteriaRepo);
        const temp = svc.createTemplate(payload, actor);
        return CMPE_UTILITIES.successEnvelope(temp, reqId);
      }
      if (action === "configuration.scoreTemplates.preview") {
        const svc = new ScoreTemplateApplicationService(scoreTempRepo, criteriaRepo);
        const result = svc.previewCalculation(payload.criteriaJson, payload.values, payload.aggregationMethod, payload.decimalPrecision);
        return CMPE_UTILITIES.successEnvelope(result, reqId);
      }
      
      // 6. configuration.scoreCriteria.* endpoints
      if (action === "configuration.scoreCriteria.create") {
        if (actor.permissions.indexOf("scoreTemplate.manage") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing scoreTemplate.manage permission", [], reqId);
        }
        const svc = new ScoreTemplateApplicationService(scoreTempRepo, criteriaRepo);
        const crit = svc.addCriterion(payload, actor);
        return CMPE_UTILITIES.successEnvelope(crit, reqId);
      }
      
      // 7. configuration.quotaRules.* endpoints
      if (action === "configuration.quotaRules.list") {
        return CMPE_UTILITIES.successEnvelope(new QuotaRuleRepository().findByTenant(tenantId), reqId);
      }
      if (action === "configuration.quotaRules.create") {
        if (actor.permissions.indexOf("quotaRule.manage") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing quotaRule.manage permission", [], reqId);
        }
        const svc = new QuotaRuleApplicationService(new QuotaRuleRepository());
        const rule = svc.createQuotaRule(payload, actor);
        return CMPE_UTILITIES.successEnvelope(rule, reqId);
      }
      
      // 8. configuration.registrationWindows.* endpoints
      if (action === "configuration.registrationWindows.list") {
        return CMPE_UTILITIES.successEnvelope(windowRepo.findByCompetition(payload.competitionId), reqId);
      }
      if (action === "configuration.registrationWindows.create") {
        if (actor.permissions.indexOf("registrationWindow.manage") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing registrationWindow.manage permission", [], reqId);
        }
        const svc = new RegistrationWindowService(windowRepo);
        const window = svc.createWindow(payload, actor);
        return CMPE_UTILITIES.successEnvelope(window, reqId);
      }
      
      // 9. configuration.medalRules.* endpoints
      if (action === "configuration.medalRules.list") {
        return CMPE_UTILITIES.successEnvelope(new MedalRuleRepository().findByTenant(tenantId), reqId);
      }
      if (action === "configuration.medalRules.create") {
        if (actor.permissions.indexOf("medalRule.manage") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing medalRule.manage permission", [], reqId);
        }
        const svc = new MedalRuleApplicationService(new MedalRuleRepository());
        const rule = svc.createMedalRule(payload, actor);
        return CMPE_UTILITIES.successEnvelope(rule, reqId);
      }
      if (action === "configuration.medalRules.preview") {
        const rule = new MedalRuleEntity(payload.rule);
        const tier = rule.classifyScore(payload.score);
        return CMPE_UTILITIES.successEnvelope({ tier: tier }, reqId);
      }
    }

    // --- REGISTRATION API METHODS (Stage 5) ---
    if (action.startsWith("registration.")) {
      const sessionMgr = getSessionManager();
      const actor = sessionMgr.verifySession(sessionToken, tenantId);
      
      const regRepo = new RegistrationRepository();
      const memberRepo = new RegistrationMemberRepository();
      const coachRepo = new CoachRepository();
      const subRepo = new SubstituteRepository();
      const attachRepo = new RegistrationAttachmentRepository();
      const historyRepo = new RegistrationHistoryRepository();
      
      const quotaSvc = new QuotaConsumptionService(
        regRepo,
        new CompetitionCategoryConfigRepository(),
        new QuotaRuleRepository()
      );
      const duplicateSvc = new DuplicateDetectionService(memberRepo, regRepo);
      const ruleRepo = new CategoryRuleRepository();
      
      const appSvc = new RegistrationApplicationService(regRepo, memberRepo, coachRepo, subRepo, attachRepo, historyRepo);
      const submissionSvc = new RegistrationSubmissionService(
        regRepo, memberRepo, coachRepo, subRepo, attachRepo, historyRepo,
        quotaSvc, duplicateSvc, ruleRepo, new CompetitionCategoryConfigRepository()
      );
      const reviewSvc = new RegistrationReviewService(regRepo, historyRepo);
      
      if (action === "registration.list") {
        const requestedSchoolId = payload.schoolId || actor.schoolId;
        const canReadTenant = actor.permissions.indexOf("registration.readTenant") !== -1;
        const list = requestedSchoolId
          ? regRepo.findBySchool(requestedSchoolId, tenantId)
          : (canReadTenant ? regRepo.findAll(tenantId) : []);
        const lookup = getRegistrationDisplayLookup_();
        const statusLabels = {
          DRAFT: "ฉบับร่าง",
          SUBMITTED: "ส่งใบสมัครแล้ว",
          UNDER_REVIEW: "อยู่ระหว่างตรวจสอบ",
          REVISION_REQUIRED: "รอแก้ไขข้อมูล",
          APPROVED: "อนุมัติแล้ว",
          REJECTED: "ไม่ผ่านการอนุมัติ",
          WITHDRAWN: "ถอนใบสมัคร",
          CHECKED_IN: "รายงานตัวแล้ว",
          COMPETED: "แข่งขันแล้ว",
          COMPLETED: "ดำเนินการเสร็จสิ้น",
          ABSENT: "ไม่มารายงานตัว",
          DISQUALIFIED: "ถูกตัดสิทธิ์"
        };
        const viewList = list.map(registration => {
          const config = lookup.configs[registration.competitionCategoryConfigId] || [];
          const categoryName = lookup.categories[config[0]] || "";
          const competitionName = lookup.competitions[registration.competitionId] || "";
          const schoolName = lookup.schools[registration.schoolId] || "";
          const levelName = lookup.levels[config[1]] || "";
          return {
            registrationId: registration.registrationId,
            registrationNumber: registration.registrationNumber || "",
            registrationStatus: registration.registrationStatus,
            rowVersion: registration.rowVersion,
            registrationDisplay: registration.registrationNumber
              ? `ใบสมัครเลขที่ ${registration.registrationNumber}`
              : "ใบสมัครที่ยังไม่ออกเลข",
            activityNameTh: categoryName || "กิจกรรมการแข่งขัน",
            competitionNameTh: competitionName || "การแข่งขันทักษะวิชาการ",
            schoolNameTh: schoolName || "โรงเรียนในสังกัด",
            educationLevelNameTh: levelName || "ระดับมัธยมศึกษา",
            statusLabelTh: statusLabels[registration.registrationStatus] || registration.registrationStatus
          };
        });
        return CMPE_UTILITIES.successEnvelope(viewList, reqId);
      }
      if (action === "registration.get") {
        const reg = regRepo.findById(payload.registrationId, tenantId);
        return CMPE_UTILITIES.successEnvelope(reg, reqId);
      }
      if (action === "registration.create") {
        if (actor.permissions.indexOf("registration.create") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing registration.create permission", [], reqId);
        }
        const created = appSvc.createRegistration(payload, actor);
        return CMPE_UTILITIES.successEnvelope(created, reqId);
      }
      if (action === "registration.submit") {
        if (actor.permissions.indexOf("registration.submit") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing registration.submit permission", [], reqId);
        }
        const submitted = submissionSvc.submitRegistration(payload.registrationId, payload.rowVersion, actor);
        return CMPE_UTILITIES.successEnvelope(submitted, reqId);
      }
      if (action === "registration.approve") {
        if (actor.permissions.indexOf("registration.approve") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing registration.approve permission", [], reqId);
        }
        const approved = reviewSvc.approveRegistration(payload.registrationId, payload.rowVersion, actor);
        return CMPE_UTILITIES.successEnvelope(approved, reqId);
      }
      if (action === "registration.reject") {
        if (actor.permissions.indexOf("registration.reject") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing registration.reject permission", [], reqId);
        }
        const rejected = reviewSvc.rejectRegistration(payload.registrationId, payload.reason, payload.rowVersion, actor);
        return CMPE_UTILITIES.successEnvelope(rejected, reqId);
      }
      
      // Members
      if (action === "registration.members.list") {
        const list = memberRepo.findByRegistration(payload.registrationId, actor.tenantId);
        return CMPE_UTILITIES.successEnvelope(list, reqId);
      }
      if (action === "registration.members.add") {
        if (actor.permissions.indexOf("registrationMember.manage") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing registrationMember.manage permission", [], reqId);
        }
        const created = appSvc.addMember(payload, actor);
        return CMPE_UTILITIES.successEnvelope(created, reqId);
      }
      
      // Coaches
      if (action === "registration.coaches.list") {
        const list = coachRepo.findByRegistration(payload.registrationId, actor.tenantId);
        return CMPE_UTILITIES.successEnvelope(list, reqId);
      }
      if (action === "registration.coaches.add") {
        if (actor.permissions.indexOf("registrationCoach.manage") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing registrationCoach.manage permission", [], reqId);
        }
        const created = appSvc.addCoach(payload, actor);
        return CMPE_UTILITIES.successEnvelope(created, reqId);
      }
    }

    // --- COMPETITION OPERATIONS API METHODS (Stage 6) ---
    if (action.startsWith("operations.")) {
      const sessionMgr = getSessionManager();
      const actor = sessionMgr.verifySession(sessionToken, tenantId);
      
      const judgeRepo = new JudgeRepository();
      const assignmentRepo = new JudgeAssignmentRepository();
      const checkinRepo = new CheckInRepository();
      const roomRepo = new CompetitionRoomRepository();
      const scheduleRepo = new RoomScheduleRepository();
      const announcementRepo = new AnnouncementRepository();
      
      const judgeConflictSvc = new JudgeConflictService(assignmentRepo);
      const scheduleConflictSvc = new ScheduleConflictService(scheduleRepo);
      
      const judgeAppSvc = new JudgeApplicationService(judgeRepo);
      const assignmentSvc = new JudgeAssignmentService(assignmentRepo, judgeRepo, judgeConflictSvc);
      const roomSvc = new CompetitionRoomService(roomRepo);
      const scheduleSvc = new ScheduleApplicationService(scheduleRepo, scheduleConflictSvc);
      const readinessSvc = new OperationalReadinessService(new RegistrationRepository(), roomRepo, assignmentRepo);
      const checkinSvc = new CheckInApplicationService(checkinRepo);
      const announceSvc = new AnnouncementApplicationService(announcementRepo);
      
      if (action === "operations.judges.create") {
        if (actor.permissions.indexOf("judge.create") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing judge.create permission", [], reqId);
        }
        const created = judgeAppSvc.createJudge(payload, actor);
        return CMPE_UTILITIES.successEnvelope(created, reqId);
      }

      if (action === "operations.judges.list") {
        return CMPE_UTILITIES.successEnvelope(judgeRepo.findAll(tenantId), reqId);
      }

      if (action === "operations.assignments.list") {
        return CMPE_UTILITIES.successEnvelope(assignmentRepo.findAll(tenantId), reqId);
      }
      
      if (action === "operations.assignments.create") {
        if (actor.permissions.indexOf("judgeAssignment.create") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing judgeAssignment.create permission", [], reqId);
        }
        const created = assignmentSvc.assignJudge(payload, actor);
        return CMPE_UTILITIES.successEnvelope(created, reqId);
      }
      
      if (action === "operations.rooms.create") {
        if (actor.permissions.indexOf("competitionRoom.manage") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing competitionRoom.manage permission", [], reqId);
        }
        const created = roomSvc.createRoom(payload, actor);
        return CMPE_UTILITIES.successEnvelope(created, reqId);
      }
      
      if (action === "operations.schedules.create") {
        if (actor.permissions.indexOf("roomSchedule.create") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing roomSchedule.create permission", [], reqId);
        }
        const created = scheduleSvc.createScheduleSlot(payload, actor);
        return CMPE_UTILITIES.successEnvelope(created, reqId);
      }
      
      if (action === "operations.readiness.validate") {
        if (actor.permissions.indexOf("operationalReadiness.validate") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing operationalReadiness.validate permission", [], reqId);
        }
        const result = readinessSvc.validateReadiness(payload.competitionId, tenantId);
        return CMPE_UTILITIES.successEnvelope(result, reqId);
      }
      
      if (action === "operations.checkin.record") {
        if (actor.permissions.indexOf("checkin.record") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing checkin.record permission", [], reqId);
        }
        const created = checkinSvc.recordCheckIn(payload, actor);
        return CMPE_UTILITIES.successEnvelope(created, reqId);
      }
      
      if (action === "operations.checkin.reverse") {
        if (actor.permissions.indexOf("checkin.reverse") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing checkin.reverse permission", [], reqId);
        }
        const reversed = checkinSvc.reverseCheckIn(payload.checkinLogId, payload.reason, actor);
        return CMPE_UTILITIES.successEnvelope(reversed, reqId);
      }
      
      if (action === "operations.announcements.create") {
        if (actor.permissions.indexOf("announcement.create") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing announcement.create permission", [], reqId);
        }
        const created = announceSvc.createAnnouncement(payload, actor);
        return CMPE_UTILITIES.successEnvelope(created, reqId);
      }
    }

    // --- SCORING & EVALUATION API METHODS (Stage 7) ---
    if (action.startsWith("scoring.") || action.startsWith("appeals.")) {
      const sessionMgr = getSessionManager();
      const actor = sessionMgr.verifySession(sessionToken, tenantId);
      
      const scRepo = new ScorecardRepository();
      const detailRepo = new ScoreDetailRepository();
      const summaryRepo = new ScoreSummaryRepository();
      const historyRepo = new ScoreLockHistoryRepository();
      const medalRepo = new MedalRepository();
      const appealRepo = new AppealRepository();
      
      const scAppSvc = new ScorecardApplicationService(scRepo, detailRepo);
      const aggSvc = new ScorePanelAggregationService(scRepo, detailRepo, summaryRepo, medalRepo);
      const verifySvc = new ChiefJudgeVerificationService(scRepo, summaryRepo);
      const lockSvc = new ResultLockApplicationService(summaryRepo, historyRepo);
      const appealSvc = new AppealApplicationService(appealRepo);
      
      if (action === "scoring.scorecards.initialize") {
        if (actor.permissions.indexOf("score.enter") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing score.enter permission", [], reqId);
        }
        const initialized = scAppSvc.initializeScorecard(payload, actor);
        return CMPE_UTILITIES.successEnvelope(initialized, reqId);
      }
      
      if (action === "scoring.scorecards.saveDraft") {
        if (actor.permissions.indexOf("score.updateOwnDraft") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing score.updateOwnDraft permission", [], reqId);
        }
        const saved = scAppSvc.saveDetailsDraft(payload.scorecardId, payload.detailsList, actor);
        return CMPE_UTILITIES.successEnvelope(saved, reqId);
      }
      
      if (action === "scoring.scorecards.submit") {
        if (actor.permissions.indexOf("score.submit") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing score.submit permission", [], reqId);
        }
        const submitted = scAppSvc.submitScorecard(payload.scorecardId, payload.rowVersion, actor);
        return CMPE_UTILITIES.successEnvelope(submitted, reqId);
      }
      
      if (action === "scoring.review.verify") {
        if (actor.permissions.indexOf("score.verify") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing score.verify permission", [], reqId);
        }
        // First run panel calculation aggregation automatically
        aggSvc.calculateFinalResult(payload.registrationId, actor);
        const verified = verifySvc.verifyResult(payload.registrationId, actor);
        return CMPE_UTILITIES.successEnvelope(verified, reqId);
      }
      
      if (action === "scoring.review.return") {
        if (actor.permissions.indexOf("score.returnForCorrection") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing score.returnForCorrection permission", [], reqId);
        }
        const returned = verifySvc.returnScorecard(payload.scorecardId, payload.reason, actor);
        return CMPE_UTILITIES.successEnvelope(returned, reqId);
      }
      
      if (action === "scoring.results.hardLock") {
        if (actor.permissions.indexOf("score.lock") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing score.lock permission", [], reqId);
        }
        const locked = lockSvc.hardLockResult(payload.registrationId, actor);
        return CMPE_UTILITIES.successEnvelope(locked, reqId);
      }
      
      if (action === "scoring.results.unlock") {
        if (actor.permissions.indexOf("score.unlock") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing score.unlock permission", [], reqId);
        }
        const unlocked = lockSvc.unlockResult(payload.registrationId, payload.reason, actor);
        return CMPE_UTILITIES.successEnvelope(unlocked, reqId);
      }
      
      if (action === "appeals.submit") {
        if (actor.permissions.indexOf("appeal.submit") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing appeal.submit permission", [], reqId);
        }
        const appeal = appealSvc.submitAppeal(payload, actor);
        return CMPE_UTILITIES.successEnvelope(appeal, reqId);
      }
    }

    // --- CERTIFICATE & VERIFICATION API METHODS (Stage 8) ---
    if (action.startsWith("certificate.")) {
      const sessionMgr = getSessionManager();
      const actor = sessionMgr.verifySession(sessionToken, tenantId);
      
      const certRepo = new CertificateRepository();
      const verifyRepo = new CertificateVerificationRepository();
      const downloadRepo = new CertificateDownloadRepository();
      
      const numSvc = new CertificateNumberService();
      const eligSvc = new CertificateEligibilityService(new ScoreSummaryRepository());
      
      const genSvc = new CertificateGenerationService(certRepo, verifyRepo, numSvc, eligSvc);
      const verifySvc = new CertificateVerificationService(verifyRepo, certRepo);
      const revokeSvc = new CertificateRevocationService(certRepo, verifyRepo);
      const regenSvc = new CertificateRegenerationService(certRepo, verifyRepo, genSvc);
      const downloadSvc = new CertificateDownloadService(downloadRepo);
      
      if (action === "certificate.generate") {
        if (actor.permissions.indexOf("certificate.generate") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing certificate.generate permission", [], reqId);
        }
        const created = genSvc.generateSingleCertificate(payload, actor);
        return CMPE_UTILITIES.successEnvelope(created, reqId);
      }
      
      if (action === "certificate.download") {
        if (actor.permissions.indexOf("certificate.download") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing certificate.download permission", [], reqId);
        }
        const logged = downloadSvc.logDownload(payload.certificateId, payload.accessType || "SCHOOL_USER", actor);
        return CMPE_UTILITIES.successEnvelope(logged, reqId);
      }
      
      if (action === "certificate.revoke") {
        if (actor.permissions.indexOf("certificate.revoke") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing certificate.revoke permission", [], reqId);
        }
        const revoked = revokeSvc.revokeCertificate(payload.certificateId, payload.reason, actor);
        return CMPE_UTILITIES.successEnvelope(revoked, reqId);
      }
      
      if (action === "certificate.regenerate") {
        if (actor.permissions.indexOf("certificate.regenerate") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing certificate.regenerate permission", [], reqId);
        }
        const regenerated = regenSvc.regenerateCertificate(payload.certificateId, payload.reason, actor);
        return CMPE_UTILITIES.successEnvelope(regenerated, reqId);
      }
    }

    // --- NOTIFICATION & QUEUES API METHODS (Stage 9) ---
    if (action.startsWith("notification.")) {
      const sessionMgr = getSessionManager();
      const actor = sessionMgr.verifySession(sessionToken, tenantId);
      
      const notifyRepo = new NotificationRepository();
      const tgRepo = new TelegramQueueRepository();
      const emailRepo = new EmailQueueRepository();
      const smsRepo = new SmsQueueRepository();
      
      const creationSvc = new NotificationCreationService(notifyRepo);
      const routingSvc = new ChannelRoutingService(tgRepo, emailRepo, smsRepo);
      
      const tgSvc = new TelegramQueueService(tgRepo);
      const emailSvc = new EmailQueueService(emailRepo);
      const smsSvc = new SmsQueueService(smsRepo);
      const staleSvc = new StaleNotificationService(notifyRepo, tgRepo, emailRepo, smsRepo);

      if (action === "notification.create") {
        if (actor.permissions.indexOf("notification.createManual") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing notification.createManual permission", [], reqId);
        }
        const created = creationSvc.createNotification(payload.notification, actor);
        let routed = [];
        if (payload.channels && payload.recipientAddress) {
          routed = routingSvc.routeNotification(created, payload.channels, payload.recipientAddress, actor);
        }
        return CMPE_UTILITIES.successEnvelope({ notification: created, routedChannels: routed }, reqId);
      }

      if (action === "notification.internal.processQueues") {
        // Enforce admin/system check
        if (actor.roles.indexOf("SUPER_ADMIN") === -1 &&
            actor.roles.indexOf("TENANT_ADMIN") === -1 &&
            actor.roles.indexOf("AREA_ADMIN") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Only system/administrators can execute worker tasks.", [], reqId);
        }
        const tgSuccess = tgSvc.processTelegramQueue(payload.batchSize || 10, actor);
        const emailSuccess = emailSvc.processEmailQueue(payload.batchSize || 10, actor);
        const smsSuccess = smsSvc.processSmsQueue(payload.batchSize || 10, actor);
        
        return CMPE_UTILITIES.successEnvelope({
          processedTelegram: tgSuccess,
          processedEmail: emailSuccess,
          processedSms: smsSuccess
        }, reqId);
      }
    }

    // --- ANALYTICS & REPORTING API METHODS (Stage 10) ---
    if (action.startsWith("analytics.")) {
      const sessionMgr = getSessionManager();
      const actor = sessionMgr.verifySession(sessionToken, tenantId);
      
      const dashRepo = new DashboardCacheRepository();
      const leaderRepo = new LeaderboardCacheRepository();
      const medalRepo = new MedalRepository();
      
      const dashSvc = new DashboardAggregationService(dashRepo);
      const leaderSvc = new LeaderboardGenerationService(leaderRepo, medalRepo);
      
      if (action === "analytics.dashboard.get") {
        if (actor.permissions.indexOf("dashboard.readTenant") === -1 && actor.permissions.indexOf("dashboard.readOwnSchool") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing dashboard read permission", [], reqId);
        }
        const dash = dashSvc.rebuildDashboard(payload.dashboardCode, actor);
        return CMPE_UTILITIES.successEnvelope(dash, reqId);
      }

      if (action === "analytics.leaderboard.schoolMedals") {
        if (actor.permissions.indexOf("leaderboard.readInternal") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing leaderboard read permission", [], reqId);
        }
        const leader = leaderSvc.generateLeaderboard("SCHOOL_MEDAL_STANDINGS", actor);
        return CMPE_UTILITIES.successEnvelope(leader, reqId);
      }
    }

    if (action.startsWith("report.")) {
      const sessionMgr = getSessionManager();
      const actor = sessionMgr.verifySession(sessionToken, tenantId);
      
      const reportRepo = new ReportRepository();
      const reportSvc = new ReportGenerationService(reportRepo);
      
      if (action === "report.request") {
        if (actor.permissions.indexOf("report.request") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing report.request permission", [], reqId);
        }
        const created = reportSvc.requestReport(payload, actor);
        return CMPE_UTILITIES.successEnvelope(created, reqId);
      }
      
      if (action === "report.get") {
        if (actor.permissions.indexOf("report.readTenant") === -1 && actor.permissions.indexOf("report.readOwn") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Missing report read permission", [], reqId);
        }
        const report = reportRepo.findById(payload.reportId, actor.tenantId);
        return CMPE_UTILITIES.successEnvelope(report, reqId);
      }

      if (action === "report.internal.processJobs") {
        if (actor.roles.indexOf("SUPER_ADMIN") === -1 &&
            actor.roles.indexOf("TENANT_ADMIN") === -1 &&
            actor.roles.indexOf("AREA_ADMIN") === -1) {
          return CMPE_UTILITIES.errorEnvelope("ERR_UNAUTHORIZED", "Only system/administrators can execute report jobs.", [], reqId);
        }
        const processed = reportSvc.processReportJob(payload.reportId, actor);
        return CMPE_UTILITIES.successEnvelope(processed, reqId);
      }
    }

    // Route not matches
    return CMPE_UTILITIES.errorEnvelope("ERR_NOT_IMPLEMENTED", "Action endpoint not found.", [], reqId);
  } catch (err) {
    return CMPE_UTILITIES.errorEnvelope("ERR_SYSTEM_FAILURE", err.toString(), [], reqId);
  }
}

/**
 * Trigger to run database provisioner and load seed configurations.
 */
function executeProvisioningAndSeed() {
  Logger.log("Starting CMPE Database Spreadsheet Provisioning...");
  const provRes = CMPE_SPREADSHEET_PROVISIONER.provisionDatabase();
  Logger.log("Sheets Created/Verified. Seeding registries...");
  const seedRes = CMPE_SEED_SERVICE.seedAllDefaults();
  
  return {
    provision: provRes,
    seed: seedRes
  };
}

/**
 * Trigger to execute automated diagnostic checks.
 */
function runSystemDiagnostics() {
  Logger.log("Executing CMP-E Provisioning Diagnostics...");
  const report = CMPE_PROVISIONING_HEALTH_CHECK.runDiagnostics();
  Logger.log("Audit Report: " + JSON.stringify(report));
  return report;
}

/**
 * Trigger to run the unit/integration test runner.
 */
function executeStage1Tests() {
  Logger.log("Executing Stage 1 Test Cases...");
  const report = CMPE_STAGE1_TESTS.runTests();
  Logger.log("Test execution result: " + JSON.stringify(report));
  return report;
}

/**
 * Trigger to run Stage 2 authentication test runner.
 */
function executeStage2Tests() {
  Logger.log("Executing Stage 2 Test Cases...");
  const report = CMPE_STAGE2_TESTS.runTests();
  Logger.log("Test execution result: " + JSON.stringify(report));
  return report;
}
