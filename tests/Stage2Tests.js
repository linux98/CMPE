/**
 * Competition Platform Engineering Standards (CPES)
 * Stage 2 Automated Authentication & Security Integration Tests
 */

const CMPE_STAGE2_TESTS = {
  runTests() {
    const results = {
      timestamp: new Date().toISOString(),
      status: "PASSED",
      total: 0,
      passed: 0,
      failed: 0,
      failures: []
    };

    function assert(condition, message) {
      results.total++;
      if (condition) {
        results.passed++;
      } else {
        results.failed++;
        results.status = "FAILED";
        results.failures.push(message);
      }
    }

    const tenantId = "SESAO_SAKON";
    const userRepo = new UserRepository();
    const sessionRepo = new SessionRepository();
    const rbacRepo = new RbacRepository();
    const hasher = new PasswordHasher();
    const clock = {
      nowIsoString: () => new Date().toISOString(),
      nowEpochMs: () => Date.now()
    };
    
    const authService = new AuthDomainService(userRepo, sessionRepo, hasher, clock);
    const sessionMgr = new SessionManager(sessionRepo, userRepo, rbacRepo, hasher, clock);

    Logger.log("--- Starting Stage 2 Authentication & Security Tests ---");

    // Clean old test users
    try {
      const uSheet = userRepo.getSheet();
      if (uSheet.getLastRow() > 1) {
        const data = uSheet.getRange(2, 1, uSheet.getLastRow() - 1, uSheet.getLastColumn()).getValues();
        const headerMap = userRepo.getHeaderMap(uSheet);
        const userCol = headerMap["username"] - 1;
        for (let i = data.length - 1; i >= 0; i--) {
          if (data[i][userCol] === "auth_test_user") {
            uSheet.deleteRow(i + 2);
          }
        }
      }
    } catch (e) {}

    // 1. Setup Test User and RBAC Roles
    let testUser = null;
    try {
      const salt = hasher.generateSalt();
      const passHash = hasher.hash("SecurePass123!", salt, 100);
      
      testUser = new UserEntity({
        userId: "AUTH_TEST_USER_ID",
        username: "auth_test_user",
        passwordHash: passHash,
        salt: salt,
        iterations: 100,
        status: "ACTIVE",
        failedLoginCount: 0,
        tenantId: tenantId
      });
      
      userRepo.create(testUser, { userId: "SYSTEM", tenantId });
      
      // Seed user_roles assignment for auth_test_user -> ROLE_SCHOOL_REGISTRAR
      const userRolesRepo = new BaseRepository("user_roles");
      
      // Clean old role assignment if exists
      const urSheet = userRolesRepo.getSheet();
      if (urSheet.getLastRow() > 1) {
        const urData = urSheet.getRange(2, 1, urSheet.getLastRow() - 1, urSheet.getLastColumn()).getValues();
        const urHeaderMap = userRolesRepo.getHeaderMap(urSheet);
        const uIdCol = urHeaderMap["userId"] - 1;
        for (let i = urData.length - 1; i >= 0; i--) {
          if (urData[i][uIdCol] === "AUTH_TEST_USER_ID") {
            urSheet.deleteRow(i + 2);
          }
        }
      }
      
      userRolesRepo.create({
        userRoleId: "UR_TEST_001",
        userId: "AUTH_TEST_USER_ID",
        roleId: "ROLE_SCHOOL_REGISTRAR",
        scope: "TENANT",
        tenantId: tenantId
      }, { userId: "SYSTEM", tenantId });
      
      assert(userRepo.exists({ username: "auth_test_user" }, tenantId), "Failed to provision test user");
    } catch (e) {
      assert(false, "Pre-test provisioning error: " + e.toString());
      return results;
    }

    // 2. Test Success Login
    try {
      const authUser = authService.authenticate("auth_test_user", "SecurePass123!", tenantId, "TEST_DEVICE", "127.0.0.1");
      assert(authUser !== null, "Authentication returned null for valid credentials");
      assert(authUser.username === "auth_test_user", "Authenticated user name property mismatch");
    } catch (e) {
      assert(false, "Login test failed: " + e.toString());
    }

    // 3. Test Invalid Password Login
    try {
      authService.authenticate("auth_test_user", "WrongPassword", tenantId, "TEST_DEVICE", "127.0.0.1");
      assert(false, "Authentication succeeded with incorrect password");
    } catch (e) {
      assert(e.message.indexOf("ERR_AUTH_001") !== -1, "Incorrect error code returned on login failure: " + e.message);
    }

    // 4. Test Lockout Security Rule (5 consecutive failed attempts lock user)
    try {
      // Current failed count should be 1 (from previous test failure)
      // Call 4 more times with wrong password
      for (let i = 0; i < 4; i++) {
        try {
          authService.authenticate("auth_test_user", "WrongPassword", tenantId, "TEST_DEVICE", "127.0.0.1");
        } catch (err) {}
      }
      
      // 5th attempt (which is the 6th overall failed login check) should throw locked error
      try {
        authService.authenticate("auth_test_user", "SecurePass123!", tenantId, "TEST_DEVICE", "127.0.0.1");
        assert(false, "Login succeeded on locked account");
      } catch (e) {
        assert(e.message.indexOf("ERR_AUTH_002") !== -1, "Account lockout was not enforced: " + e.message);
      }
      
      // Force unlock test user for remaining tests
      const lockedUser = new UserEntity(userRepo.findById("AUTH_TEST_USER_ID", tenantId));
      lockedUser.failedLoginCount = 0;
      lockedUser.status = "ACTIVE";
      lockedUser.lockoutUntil = "";
      userRepo.update(lockedUser, lockedUser.rowVersion, { userId: "SYSTEM", tenantId });
    } catch (e) {
      assert(false, "Lockout security test error: " + e.toString());
    }

    // 5. Test Session Manager & Expirations (Remember Me)
    try {
      // Session with rememberMe: false (4 hours duration)
      const sessionNormal = sessionMgr.createSession("AUTH_TEST_USER_ID", tenantId, "DEVICE_A", "127.0.0.1", false);
      const normalExpiry = new Date(sessionNormal.expiryTimestamp).getTime();
      const approxNormal = Date.now() + 4 * 60 * 60 * 1000;
      assert(Math.abs(normalExpiry - approxNormal) < 60000, "Normal session duration is not approximately 4 hours");
      
      // Session with rememberMe: true (30 days duration)
      const sessionRemember = sessionMgr.createSession("AUTH_TEST_USER_ID", tenantId, "DEVICE_B", "127.0.0.1", true);
      const rememberExpiry = new Date(sessionRemember.expiryTimestamp).getTime();
      const approxRemember = Date.now() + 30 * 24 * 60 * 60 * 1000;
      assert(Math.abs(rememberExpiry - approxRemember) < 60000, "Remember Me session duration is not approximately 30 days");
      
      // Verify Session Context (Session verify retrieves correct roles & permissions)
      const context = sessionMgr.verifySession(sessionNormal.rawToken, tenantId);
      assert(context.userId === "AUTH_TEST_USER_ID", "Verify session context returned incorrect userId");
      assert(context.roles.indexOf("SCHOOL_REGISTRAR") !== -1, "Verify session context did not return correct user roles");
      assert(context.permissions.indexOf("registration.create") !== -1, "Verify session context did not return correct permissions mapping");
    } catch (e) {
      assert(false, "Session Manager test failed: " + e.toString());
    }

    // 6. Test Concurrent Sessions Limits (Max 5 active sessions allowed)
    try {
      // Reset active sessions for AUTH_TEST_USER_ID
      sessionRepo.revokeAllSessionsForUser("AUTH_TEST_USER_ID");
      
      const sessionTokens = [];
      // Generate 5 active sessions
      for (let i = 0; i < 5; i++) {
        sessionTokens.push(sessionMgr.createSession("AUTH_TEST_USER_ID", tenantId, "DEVICE_" + i, "127.0.0.1", false));
      }
      
      // Check active sessions count
      let active = sessionRepo.findActiveSessionsForUser("AUTH_TEST_USER_ID");
      assert(active.length === 5, "Active session count mismatch, found: " + active.length);
      
      // Generate 6th session (should evict session #1)
      const session6 = sessionMgr.createSession("AUTH_TEST_USER_ID", tenantId, "DEVICE_6", "127.0.0.1", false);
      
      active = sessionRepo.findActiveSessionsForUser("AUTH_TEST_USER_ID");
      assert(active.length === 5, "Concurreny sessions exceeded limit of 5. Found: " + active.length);
      
      // Verify session #1 is no longer active
      try {
        sessionMgr.verifySession(sessionTokens[0].rawToken, tenantId);
        assert(false, "Session #1 was not evicted on 6th session creation");
      } catch (err) {
        assert(err.message.indexOf("ERR_AUTH_003") !== -1, "Session verification of evicted token did not throw correct error code");
      }
    } catch (e) {
      assert(false, "Concurrent session limits test error: " + e.toString());
    }

    // 7. Cleanup Test User Session rows
    try {
      sessionRepo.revokeAllSessionsForUser("AUTH_TEST_USER_ID");
    } catch (e) {}

    return results;
  }
};
