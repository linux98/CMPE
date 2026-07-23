/**
 * Competition Platform Engineering Standards (CPES)
 * Stage 11 - Production Validation Tool
 */

const CMPE_PROD_VALIDATOR = {
  /**
   * Run the production readiness verification checklist.
   * Returns a structured report envelope.
   */
  validateProduction() {
    const report = {
      overallStatus: "READY_FOR_UAT",
      checks: [],
      summary: {
        passed: 0,
        warnings: 0,
        failed: 0,
        blockingFailures: 0
      }
    };

    function addCheck(code, status, message, blocking, remediation = "") {
      report.checks.push({ checkCode: code, status, message, blocking, remediation });
      if (status === "PASSED") {
        report.summary.passed++;
      } else if (status === "WARNING") {
        report.summary.warnings++;
      } else {
        report.summary.failed++;
        if (blocking) {
          report.summary.blockingFailures++;
          report.overallStatus = "NOT_READY";
        } else if (report.overallStatus === "READY_FOR_UAT") {
          report.overallStatus = "CONDITIONALLY_READY";
        }
      }
    }

    // 1. Validate Script Properties
    let properties = {};
    try {
      properties = PropertiesService.getScriptProperties().getProperties();
    } catch (e) {
      properties = {}; // Mock fallback or error
    }

    const requiredKeys = [
      "ENVIRONMENT",
      "DATABASE_SPREADSHEET_ID",
      "PUBLIC_WEB_APP_URL",
      "BACKUP_FOLDER_ID",
      "REPORT_FOLDER_ID",
      "CERTIFICATE_FOLDER_ID",
      "TEMPLATE_FOLDER_ID",
      "PASSWORD_HASH_ITERATIONS",
      "SESSION_TIMEOUT_MINUTES"
    ];

    requiredKeys.forEach(key => {
      const val = properties[key];
      if (val && val.trim() !== "") {
        addCheck(`PROP_${key}`, "PASSED", `Property ${key} is present and non-empty.`, true);
      } else {
        addCheck(`PROP_${key}`, "FAILED", `Property ${key} is missing or empty.`, true, `Set ${key} in Apps Script Project Script Properties.`);
      }
    });

    // Secret Properties Check (No leak)
    const secrets = [
      "TELEGRAM_BOT_TOKEN",
      "GMAIL_API_CREDENTIALS",
      "DEFAULT_TELEGRAM_CHAT_ID"
    ];

    secrets.forEach(sec => {
      const val = properties[sec];
      if (val && val.trim() !== "") {
        addCheck(`SECRET_${sec}`, "PASSED", `Secret property ${sec} is PRESENT.`, false);
      } else {
        addCheck(`SECRET_${sec}`, "WARNING", `Secret property ${sec} is MISSING.`, false, `Add secret token ${sec} before opening notification channels.`);
      }
    });

    // 2. Open spreadsheet & validate sheets
    const ssId = properties["DATABASE_SPREADSHEET_ID"] || "";
    let ss = null;
    if (ssId) {
      try {
        ss = SpreadsheetApp.openById(ssId);
        addCheck("SS_ACCESSIBILITY", "PASSED", "Spreadsheet exists and is accessible.", true);
        
        // Name convention check
        const ssName = ss.getName();
        if (ssName.indexOf("PROD") !== -1 || ssName.indexOf("AY_2569") !== -1) {
          addCheck("SS_NAME_CONVENTION", "PASSED", `Spreadsheet name '${ssName}' matches convention.`, false);
        } else {
          addCheck("SS_NAME_CONVENTION", "WARNING", `Spreadsheet name '${ssName}' does not strictly match PROD/AY_2569 convention.`, false, "Rename spreadsheet to follow production naming convention.");
        }
      } catch (e) {
        addCheck("SS_ACCESSIBILITY", "FAILED", "Failed to access production spreadsheet: " + e.toString(), true, "Check database spreadsheet permissions and ID.");
      }
    } else {
      addCheck("SS_ACCESSIBILITY", "FAILED", "Spreadsheet ID property is empty.", true, "Configure DATABASE_SPREADSHEET_ID.");
    }

    if (ss) {
      // Validate all worksheets catalog
      const catalog = CMPE_CONSTANTS.TableCatalog;
      const metadataCols = CMPE_CONSTANTS.MetadataColumns;

      for (const sheetName in catalog) {
        const config = catalog[sheetName];
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) {
          addCheck(`SHEET_${sheetName.toUpperCase()}`, "FAILED", `Worksheet '${sheetName}' is missing from database.`, true, `Run spreadsheet provisioner to create '${sheetName}' sheet.`);
          continue;
        }

        // Validate headers and duplicate checks
        let expectedHeaders = [config.pk].concat(config.cols);
        if (config.mutable) {
          expectedHeaders = expectedHeaders.concat(metadataCols);
        }
        expectedHeaders = expectedHeaders.filter((h, idx) => expectedHeaders.indexOf(h) === idx);
        const actualHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1).getValues()[0];
        const duplicates = actualHeaders.filter((item, index) => actualHeaders.indexOf(item) !== index && item !== "");
        
        if (duplicates.length > 0) {
          addCheck(`HEADERS_DUP_${sheetName.toUpperCase()}`, "FAILED", `Duplicate headers detected in '${sheetName}': ${duplicates.join(",")}`, true, "Remove duplicate columns manually.");
        } else {
          // Check core columns presence
          let match = true;
          expectedHeaders.forEach((h, idx) => {
            if (actualHeaders[idx] !== h) match = false;
          });
          if (match) {
            addCheck(`SHEET_${sheetName.toUpperCase()}`, "PASSED", `Worksheet '${sheetName}' schema matches frozen specification.`, true);
          } else {
            addCheck(`SHEET_${sheetName.toUpperCase()}`, "FAILED", `Worksheet '${sheetName}' headers do not match specification.`, true, `Re-run provisioner to repair '${sheetName}' headers.`);
          }
        }
      }

      // Check migration log status
      const migrationsSheet = ss.getSheetByName("migrations");
      if (migrationsSheet && migrationsSheet.getLastRow() > 1) {
        const mData = migrationsSheet.getRange(2, 1, migrationsSheet.getLastRow() - 1, migrationsSheet.getLastColumn()).getValues();
        let runningOrFailed = false;
        mData.forEach(row => {
          const status = row[5] ? row[5].toString() : ""; // execution log or status
          if (status.indexOf("FAILED") !== -1 || status.indexOf("RUNNING") !== -1) {
            runningOrFailed = true;
          }
        });
        if (runningOrFailed) {
          addCheck("MIGRATIONS_HEALTH", "FAILED", "Failed or running migration logs detected in database.", true, "Check migrations log and apply hotfixes.");
        } else {
          addCheck("MIGRATIONS_HEALTH", "PASSED", "All recorded migrations have completed successfully.", true);
        }
      } else {
        addCheck("MIGRATIONS_HEALTH", "WARNING", "No migrations records found in database.", false, "Ensure provisioner has been executed at least once.");
      }

      // Seed audits
      const tenantsSheet = ss.getSheetByName("tenants");
      if (tenantsSheet && tenantsSheet.getLastRow() > 1) {
        addCheck("SEED_TENANTS", "PASSED", "Production tenants registry has been seeded.", true);
      } else {
        addCheck("SEED_TENANTS", "FAILED", "Production tenants sheet is empty.", true, "Seed default tenants registry.");
      }

      const rolesSheet = ss.getSheetByName("roles");
      if (rolesSheet && rolesSheet.getLastRow() > 1) {
        addCheck("SEED_ROLES", "PASSED", "System security roles have been seeded.", true);
      } else {
        addCheck("SEED_ROLES", "FAILED", "System roles sheet is empty.", true, "Seed standard RBAC roles.");
      }
    }

    // 3. Drive Folders validation
    const folderKeys = [
      { key: "BACKUP_FOLDER_ID", label: "Backup Directory" },
      { key: "REPORT_FOLDER_ID", label: "Reports Directory" },
      { key: "CERTIFICATE_FOLDER_ID", label: "Certificates Directory" },
      { key: "TEMPLATE_FOLDER_ID", label: "Templates Directory" }
    ];

    folderKeys.forEach(f => {
      const id = properties[f.key];
      if (id) {
        try {
          const folder = DriveApp.getFolderById(id);
          const name = folder.getName();
          const sharing = folder.getSharingAccess().toString();
          if (sharing === "ANYONE" || sharing === "ANYONE_WITH_LINK") {
            addCheck(`FOLDER_${f.key}`, "WARNING", `Drive folder '${name}' is public!`, false, `Restrict sharing permissions for folder ID: ${id}`);
          } else {
            addCheck(`FOLDER_${f.key}`, "PASSED", `Drive folder '${name}' is secure and accessible.`, true);
          }
        } catch (e) {
          addCheck(`FOLDER_${f.key}`, "FAILED", `Drive folder ID '${id}' is inaccessible: ` + e.toString(), true, `Verify folder ownership and permissions.`);
        }
      } else {
        addCheck(`FOLDER_${f.key}`, "FAILED", `Drive folder ID for '${f.label}' is missing.`, true, `Configure ${f.key} script property.`);
      }
    });

    // 4. Slide Certificate Templates validation
    const certTemplateId = properties["TEMPLATE_FOLDER_ID"] || "";
    if (certTemplateId) {
      try {
        const files = DriveApp.getFolderById(certTemplateId).getFiles();
        let found = false;
        while (files.hasNext()) {
          const file = files.next();
          const mime = file.getMimeType();
          if (mime === "application/vnd.google-apps.presentation" || file.getName().indexOf("Certificate") !== -1) {
            found = true;
            addCheck("CERT_TEMPLATE_VALIDATION", "PASSED", `Certificate template file found: ${file.getName()}`, true);
            break;
          }
        }
        if (!found) {
          addCheck("CERT_TEMPLATE_VALIDATION", "WARNING", "No active Google Slides certificate templates detected in templates folder.", false, "Upload certificate layout Slides template to the template folder.");
        }
      } catch (e) {
        addCheck("CERT_TEMPLATE_VALIDATION", "FAILED", "Failed to access templates directory: " + e.toString(), true, "Verify template folder ID permissions.");
      }
    } else {
      addCheck("CERT_TEMPLATE_VALIDATION", "FAILED", "Template folder ID script property is missing.", true, "Configure TEMPLATE_FOLDER_ID.");
    }

    // 5. Deployed Web App validation
    const webAppUrl = properties["PUBLIC_WEB_APP_URL"] || "";
    if (webAppUrl) {
      if (webAppUrl.indexOf("https://script.google.com") === 0) {
        addCheck("WEB_APP_URL", "PASSED", "Production web app URL format is valid.", true);
      } else {
        addCheck("WEB_APP_URL", "FAILED", `Invalid web app URL target: ${webAppUrl}`, true, "Set PUBLIC_WEB_APP_URL to your deployed Google Apps Script URL.");
      }
    } else {
      addCheck("WEB_APP_URL", "FAILED", "Production Web App URL script property is missing.", true, "Configure PUBLIC_WEB_APP_URL.");
    }

    // 6. Installable Triggers Check
    try {
      const triggers = ScriptApp.getProjectTriggers();
      if (triggers.length > 0) {
        addCheck("TRIGGERS_INSPECTION", "PASSED", `Found ${triggers.length} installable triggers.`, false);
      } else {
        addCheck("TRIGGERS_INSPECTION", "WARNING", "No project triggers have been installed yet.", false, "Install cron queue triggers prior to opening competition registration.");
      }
    } catch (e) {
      addCheck("TRIGGERS_INSPECTION", "WARNING", "Failed to read project triggers: " + e.toString(), false);
    }

    // 7. Smoke tests (isolated memory checks)
    try {
      const hasConstants = typeof CMPE_CONSTANTS !== "undefined";
      const hasBaseRepo = typeof BaseRepository !== "undefined";
      
      if (hasConstants && hasBaseRepo) {
        // Instantiate representative repository classes to check constructor resolution
        const repos = [
          new UserRepository(),
          new SessionRepository(),
          new RegistrationRepository(),
          new ScorecardRepository(),
          new CertificateRepository(),
          new NotificationRepository(),
          new DashboardCacheRepository(),
          new ReportRepository()
        ];
        addCheck("SMOKE_TEST_MEMORY", "PASSED", `Smoke test succeeded. Verified BaseRepository and ${repos.length} repository class constructions.`, true);
      } else {
        addCheck("SMOKE_TEST_MEMORY", "FAILED", "Dependency missing during smoke tests.", true);
      }
    } catch (e) {
      addCheck("SMOKE_TEST_MEMORY", "FAILED", "Smoke test failure: " + e.toString(), true);
    }

    return report;
  }
};

// Make accessible online
if (typeof global !== "undefined") {
  global.CMPE_PROD_VALIDATOR = CMPE_PROD_VALIDATOR;
}
