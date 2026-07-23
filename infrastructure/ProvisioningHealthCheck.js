/**
 * Competition Platform Engineering Standards (CPES)
 * Infrastructure Provisioning Health Check Service
 */

const CMPE_PROVISIONING_HEALTH_CHECK = {
  /**
   * Performs automated health audits across all 75 worksheets.
   * Returns validation metrics.
   */
  runDiagnostics() {
    const ssId = CMPE_ENVIRONMENT.getSpreadsheetId();
    const ss = SpreadsheetApp.openById(ssId);
    const catalog = CMPE_CONSTANTS.TableCatalog;
    const metadataCols = CMPE_CONSTANTS.MetadataColumns;
    
    const diagnostics = {
      timestamp: new Date().toISOString(),
      databaseId: ssId,
      status: "HEALTHY",
      totalSheets: 75,
      sheetsChecked: 0,
      missingSheets: [],
      headerMismatches: [],
      seedAudit: {
        rolesCount: 0,
        permissionsCount: 0,
        tenantsCount: 0
      }
    };
    
    for (const sheetName in catalog) {
      const config = catalog[sheetName];
      const sheet = ss.getSheetByName(sheetName);
      
      if (!sheet) {
        diagnostics.status = "UNHEALTHY";
        diagnostics.missingSheets.push(sheetName);
        continue;
      }
      
      diagnostics.sheetsChecked++;
      
      // Check Headers mapping
      let expectedHeaders = [config.pk].concat(config.cols);
      if (config.mutable) {
        expectedHeaders = expectedHeaders.concat(metadataCols);
      }
      expectedHeaders = expectedHeaders.filter((h, idx) => expectedHeaders.indexOf(h) === idx);
      
      const actualHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1).getValues()[0];
      const headerMatch = expectedHeaders.every((h, idx) => actualHeaders[idx] === h);
      
      if (!headerMatch) {
        diagnostics.status = "UNHEALTHY";
        diagnostics.headerMismatches.push({
          sheet: sheetName,
          expected: expectedHeaders,
          actual: actualHeaders
        });
      }
    }
    
    // Seed verification audits
    try {
      const rolesSheet = ss.getSheetByName("roles");
      if (rolesSheet) diagnostics.seedAudit.rolesCount = rolesSheet.getLastRow() - 1;
      
      const permsSheet = ss.getSheetByName("permissions");
      if (permsSheet) diagnostics.seedAudit.permissionsCount = permsSheet.getLastRow() - 1;
      
      const tenantsSheet = ss.getSheetByName("tenants");
      if (tenantsSheet) diagnostics.seedAudit.tenantsCount = tenantsSheet.getLastRow() - 1;
    } catch (err) {
      diagnostics.status = "UNHEALTHY";
    }
    
    return diagnostics;
  }
};
