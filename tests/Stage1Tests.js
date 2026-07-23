/**
 * Competition Platform Engineering Standards (CPES)
 * Stage 1 Automated Unit & Integration Tests
 */

const CMPE_STAGE1_TESTS = {
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

    Logger.log("--- Starting Stage 1 Core Unit Tests ---");

    // 1. Test UUID Generator
    try {
      const uuid1 = CMPE_UTILITIES.generateUuid();
      const uuid2 = CMPE_UTILITIES.generateUuid();
      assert(uuid1 && uuid2 && uuid1 !== uuid2, "UUID generation unique checks failed");
    } catch (e) {
      assert(false, "UUID test error: " + e.toString());
    }

    // 2. Test Hashing & Constant Time Compare
    try {
      const pass = "SuperSecurePassword123";
      const salt = "random_salt_string";
      const hash1 = CMPE_UTILITIES.hashPassword(pass, salt, 100);
      const hash2 = CMPE_UTILITIES.hashPassword(pass, salt, 100);
      const differentHash = CMPE_UTILITIES.hashPassword("WrongPassword", salt, 100);
      
      assert(hash1 === hash2, "Deterministic hash values mismatch");
      assert(CMPE_UTILITIES.constantTimeCompare(hash1, hash2), "Constant-time same match failed");
      assert(!CMPE_UTILITIES.constantTimeCompare(hash1, differentHash), "Constant-time false mismatch failed");
    } catch (e) {
      assert(false, "Hashing test error: " + e.toString());
    }

    // 3. Test Name Validator
    try {
      assert(CMPE_UTILITIES.isValidName("Somsak Somdee"), "Valid English name failed");
      assert(CMPE_UTILITIES.isValidName("สมเกียรติ มั่นคง"), "Valid Thai name failed");
      assert(!CMPE_UTILITIES.isValidName("Somsak123"), "Digit name validation bypass");
      assert(!CMPE_UTILITIES.isValidName("Somdee <script>alert(1)</script>"), "Injection string validation bypass");
    } catch (e) {
      assert(false, "Validator test error: " + e.toString());
    }

    // 4. Test API Envelopes
    try {
      const success = CMPE_UTILITIES.successEnvelope({ foo: "bar" }, "req-123", 2);
      assert(success.success === true, "Success flag envelope mismatch");
      assert(success.meta.rowVersion === 2, "Envelope metadata version mismatch");
      assert(success.data.foo === "bar", "Envelope data contents mismatch");
      
      const error = CMPE_UTILITIES.errorEnvelope("ERR_CODE", "Error Msg", ["det"], "req-123");
      assert(error.success === false, "Error flag envelope mismatch");
      assert(error.error.code === "ERR_CODE", "Error envelope code mismatch");
    } catch (e) {
      assert(false, "Envelope test error: " + e.toString());
    }

    Logger.log("--- Starting Stage 1 Repository Integration Tests ---");
    
    // We will use the 'settings' sheet for integration testing because it is mutable and has metadata columns.
    try {
      // Clear settings test entries first
      const settingsRepo = new BaseRepository("settings");
      const sheet = settingsRepo.getSheet();
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        // Find if test setting exists and delete it directly for clean test run
        const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
        const headerMap = settingsRepo.getHeaderMap(sheet);
        const pkIdx = headerMap[settingsRepo.pkName] - 1;
        for (let i = data.length - 1; i >= 0; i--) {
          if (data[i][pkIdx] === "TEST_SETTING_ID") {
            sheet.deleteRow(i + 2);
          }
        }
      }
      
      const actor = { userId: "TEST_USER_1", tenantId: "SESAO_SAKON", roles: ["SUPER_ADMIN"] };
      
      // Test Create
      const newSetting = {
        settingId: "TEST_SETTING_ID",
        tenantId: "SESAO_SAKON",
        key: "test_key",
        value: "test_value",
        description: "Integration testing setting",
        type: "STRING"
      };
      
      settingsRepo.create(newSetting, actor);
      assert(settingsRepo.exists({ settingId: "TEST_SETTING_ID" }, "SESAO_SAKON"), "Repository exists check failed after create");
      
      // Test FindById
      const retrieved = settingsRepo.findById("TEST_SETTING_ID", "SESAO_SAKON");
      assert(retrieved !== null, "FindById returned null for created entry");
      assert(retrieved.value === "test_value", "Retrieved property mismatch");
      assert(retrieved.rowVersion === 1, "Initial rowVersion is not 1");
      assert(retrieved.recordStatus === "ACTIVE", "Initial status is not ACTIVE");
      
      // Test Tenant Boundary Breach Safeguard
      try {
        settingsRepo.findById("TEST_SETTING_ID", "SESAO_UDON"); // Incorrect tenant context
        assert(false, "Tenant isolation violation was not blocked");
      } catch (err) {
        assert(err.message.indexOf("ERR_TENANT_ISOLATION_VIOLATION") !== -1, "Tenant violation returned incorrect message: " + err.message);
      }
      
      // Test Update (Success)
      retrieved.value = "updated_test_value";
      settingsRepo.update(retrieved, 1, actor); // Expected version is 1
      
      const updated = settingsRepo.findById("TEST_SETTING_ID", "SESAO_SAKON");
      assert(updated.value === "updated_test_value", "Updated property mismatch");
      assert(updated.rowVersion === 2, "Row version was not incremented to 2");
      
      // Test Concurrency Lock Safe Guard (Failure)
      try {
        updated.value = "stale_update";
        settingsRepo.update(updated, 1, actor); // Expected version is 1 (which is now stale since actual is 2)
        assert(false, "Stale update optimistic concurrency bypass succeeded");
      } catch (err) {
        assert(err.message.indexOf("ERR_CONCURRENCY_409") !== -1, "Concurrency violation returned incorrect message: " + err.message);
      }
      
      // Test Archive (Soft Delete)
      settingsRepo.archive("TEST_SETTING_ID", 2, actor);
      
      const archived = settingsRepo.findById("TEST_SETTING_ID", "SESAO_SAKON");
      assert(archived === null, "Archived record was returned by findById queries");
      
    } catch (e) {
      assert(false, "Repository integration test error: " + e.toString());
    }

    Logger.log("--- Diagnostics & Health Checks Test ---");
    try {
      const diagnostics = CMPE_PROVISIONING_HEALTH_CHECK.runDiagnostics();
      assert(diagnostics.sheetsChecked === 75, "Health checks did not verify all 75 worksheets. Inspected: " + diagnostics.sheetsChecked);
      assert(diagnostics.status === "HEALTHY", "Diagnostics reported database status as UNHEALTHY: " + JSON.stringify(diagnostics.headerMismatches));
    } catch (e) {
      assert(false, "Diagnostics test error: " + e.toString());
    }

    return results;
  }
};
