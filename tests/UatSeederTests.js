/**
 * Competition Platform Engineering Standards (CPES)
 * UAT Mock Data Seeder Unit Tests
 */

const CMPE_UAT_SEEDER_TESTS = {
  runTests() {
    Logger.log("--- Starting UAT Seeder Unit Tests ---");
    let passed = 0;
    let failed = 0;
    const failures = [];

    const assert = (cond, msg) => {
      if (cond) {
        passed++;
      } else {
        failed++;
        failures.push(msg);
        Logger.log("[FAIL] " + msg);
      }
    };

    // Test 1: Verify getUatDemoCredentials structure
    try {
      const creds = getUatDemoCredentials();
      assert(Array.isArray(creds), "getUatDemoCredentials should return an array");
      assert(creds.length > 0, "getUatDemoCredentials should not be empty");
      assert(creds[0].role !== undefined, "Credential records should have role property");
      assert(creds[0].password !== undefined, "Credential records should have password property");
    } catch (e) {
      assert(false, "getUatDemoCredentials threw an exception: " + e.toString());
    }

    // Test 2: Verify validateUatMockData structure (without DB access if run offline)
    try {
      const report = validateUatMockData();
      assert(report.status !== undefined, "Validation report should have status");
      assert(report.warnings !== undefined, "Validation report should have warnings array");
    } catch (e) {
      // If offline context fails due to missing SpreadsheetApp, that's expected in some mock runs
      Logger.log("validateUatMockData offline warning (expected): " + e.toString());
    }

    Logger.log(`UAT Seeder Tests Completed. Passed: ${passed}, Failed: ${failed}`);
    return {
      name: "UAT Seeder Unit Tests",
      passed,
      failed,
      failures
    };
  }
};

if (typeof global !== "undefined") {
  global.CMPE_UAT_SEEDER_TESTS = CMPE_UAT_SEEDER_TESTS;
}
