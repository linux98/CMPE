/**
 * Competition Platform Engineering Standards (CPES)
 * Stage 11 - Production Validation Automated Unit Tests
 */

const CMPE_PROD_VALIDATION_TESTS = {
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

    Logger.log("--- Starting Production Preparation Validation Unit Tests ---");

    // Backup existing mocks/globals
    const oldPropertiesService = PropertiesService;
    const oldSpreadsheetApp = SpreadsheetApp;
    const oldDriveApp = DriveApp;
    const oldScriptApp = ScriptApp;

    // Test Case 1: Missing properties produces NOT_READY
    PropertiesService = {
      getScriptProperties() {
        return {
          getProperties() {
            return {
              ENVIRONMENT: "PROD" // Other properties missing
            };
          }
        };
      }
    };

    SpreadsheetApp = {
      openById() {
        throw new Error("Unavailable spreadsheet");
      }
    };

    DriveApp = {
      getFolderById() {
        throw new Error("Folder inaccessible");
      }
    };

    ScriptApp = {
      getProjectTriggers() {
        return [];
      }
    };

    try {
      const report = CMPE_PROD_VALIDATOR.validateProduction();
      assert(report.overallStatus === "NOT_READY", "Validation should fail with NOT_READY when properties are missing.");
      assert(report.summary.blockingFailures > 0, "Blocking failures count should be greater than 0.");
    } catch (e) {
      assert(false, "Test Case 1 failed: " + e.toString());
    }

    // Test Case 2: Valid setup validation works
    PropertiesService = {
      getScriptProperties() {
        return {
          getProperties() {
            return {
              ENVIRONMENT: "PROD",
              DATABASE_SPREADSHEET_ID: "SS_MOCK_123",
              PUBLIC_WEB_APP_URL: "https://script.google.com/macros/s/123/exec",
              BACKUP_FOLDER_ID: "FLD_MOCK_BACKUP",
              REPORT_FOLDER_ID: "FLD_MOCK_REPORTS",
              CERTIFICATE_FOLDER_ID: "FLD_MOCK_CERTS",
              TEMPLATE_FOLDER_ID: "FLD_MOCK_TEMPLATES",
              PASSWORD_HASH_ITERATIONS: "10000",
              SESSION_TIMEOUT_MINUTES: "30"
            };
          }
        };
      }
    };

    SpreadsheetApp = {
      openById() {
        return {
          getName: () => "PROD_AY_2569_CMPE",
          getSheetByName: (name) => {
            if (name === "migrations") {
              return {
                getLastRow: () => 2,
                getLastColumn: () => 6,
                getRange: () => ({
                  getValues: () => [
                    ["migrationId", "versionFrom", "versionTo", "checksum", "appliedTimestamp", "executionLog"],
                    ["1", "0.0.0", "1.0.0", "SHA256_CHECKSUM_OK", "2026-07-23", "Database Provisioned Successfully."]
                  ]
                })
              };
            }
            const config = CMPE_CONSTANTS.TableCatalog[name];
            let mockHeaders = [];
            if (config) {
              mockHeaders = [config.pk].concat(config.cols);
              if (config.mutable) {
                mockHeaders = mockHeaders.concat(CMPE_CONSTANTS.MetadataColumns);
              }
            }
            mockHeaders = mockHeaders.filter((h, idx) => mockHeaders.indexOf(h) === idx);
            const isSeeded = (name === "tenants" || name === "roles");
            return {
              getLastRow: () => isSeeded ? 5 : 1,
              getLastColumn: () => mockHeaders.length,
              getRange: () => ({
                getValues: () => {
                  const rows = [mockHeaders];
                  if (isSeeded) {
                    rows.push(mockHeaders.map((_, i) => i === 0 ? "1" : (i === 1 ? "SESAO_SAKON" : "")));
                  }
                  return rows;
                }
              })
            };
          }
        };
      }
    };

    DriveApp = {
      getFolderById(id) {
        return {
          getName: () => "Mock Directory " + id,
          getSharingAccess: () => "PRIVATE",
          getFiles: () => ({
            hasNext: () => true,
            next: () => ({
              getMimeType: () => "application/vnd.google-apps.presentation",
              getName: () => "Certificate Template Layout"
            })
          })
        };
      }
    };

    try {
      const report = CMPE_PROD_VALIDATOR.validateProduction();
      if (report.overallStatus !== "READY_FOR_UAT") {
        const failedChecks = report.checks.filter(c => c.status === "FAILED");
        console.log("Failed checks list:", JSON.stringify(failedChecks, null, 2));
      }
      assert(report.overallStatus === "READY_FOR_UAT", "Validation should pass with READY_FOR_UAT when setup is complete: " + JSON.stringify(report.summary));
    } catch (e) {
      assert(false, "Test Case 2 failed: " + e.toString());
    }

    // Restore original variables
    PropertiesService = oldPropertiesService;
    SpreadsheetApp = oldSpreadsheetApp;
    DriveApp = oldDriveApp;
    ScriptApp = oldScriptApp;

    return results;
  }
};
