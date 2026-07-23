/**
 * Competition Platform Engineering Standards (CPES)
 * Infrastructure Base Repository Adapter
 */

class BaseRepository {
  constructor(sheetName) {
    this.sheetName = sheetName;
    const config = CMPE_CONSTANTS.TableCatalog[sheetName];
    if (!config) {
      throw new Error("Invalid sheet name: " + sheetName);
    }
    this.pkName = config.pk;
    this.isMutable = config.mutable;
  }

  /**
   * Helper to open sheet range
   */
  getSheet() {
    const ssId = CMPE_ENVIRONMENT.getSpreadsheetId();
    return SpreadsheetApp.openById(ssId).getSheetByName(this.sheetName);
  }

  /**
   * Helper to get header index mappings
   */
  getHeaderMap(sheet) {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1).getValues()[0];
    const map = {};
    headers.forEach((h, idx) => {
      if (h) map[h] = idx + 1; // 1-indexed column numbers
    });
    return map;
  }

  /**
   * Maps sheet values row to JS object
   */
  mapRowToObject(rowValues, headerMap) {
    const obj = {};
    for (const key in headerMap) {
      const idx = headerMap[key] - 1;
      obj[key] = rowValues[idx];
    }
    return obj;
  }

  /**
   * Maps JS object back to array matching header ordering
   */
  mapObjectToRow(obj, headerMap) {
    const row = [];
    const keys = Object.keys(headerMap).sort((a, b) => headerMap[a] - headerMap[b]);
    keys.forEach(key => {
      row.push(obj[key] === undefined || obj[key] === null ? "" : obj[key]);
    });
    return row;
  }

  /**
   * Find by Technical Primary Key (Tenant isolated check included)
   */
  findById(id, tenantContext) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return null;
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    
    const pkColIdx = headerMap[this.pkName] - 1;
    const tenantColIdx = headerMap["tenantId"] ? headerMap["tenantId"] - 1 : -1;
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row[pkColIdx] === id) {
        // Enforce tenant boundary safety checks
        if (tenantColIdx !== -1 && tenantContext && row[tenantColIdx] !== tenantContext) {
          throw new Error("ERR_TENANT_ISOLATION_VIOLATION: Data boundary breach blocked.");
        }
        
        // Skip soft-deleted records if mutable
        if (headerMap["recordStatus"] && row[headerMap["recordStatus"] - 1] === "DELETED") {
          return null;
        }
        
        return this.mapRowToObject(row, headerMap);
      }
    }
    return null;
  }

  /**
   * Check if record exists
   */
  exists(uniqueSpecification, tenantContext) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return false;
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    
    return data.some(row => {
      // Check tenant isolation
      if (headerMap["tenantId"] && tenantContext) {
        if (row[headerMap["tenantId"] - 1] !== tenantContext) return false;
      }
      
      // Match all query properties
      for (const propName in uniqueSpecification) {
        const colIdx = headerMap[propName] - 1;
        if (colIdx === undefined || row[colIdx] !== uniqueSpecification[propName]) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Creates new transactional entry using optimistic concurrency LockService
   */
  create(entity, actorContext) {
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000); // 10 seconds timeout lock
    } catch (e) {
      throw new Error("ERR_DB_201: Lock contention timeout on create operation.");
    }
    
    try {
      const sheet = this.getSheet();
      const headerMap = this.getHeaderMap(sheet);
      
      // Inject standard creation metadata
      if (this.isMutable) {
        if (headerMap["tenantId"] && actorContext && actorContext.tenantId) {
          entity.tenantId = actorContext.tenantId;
        }
        entity.createdTimestamp = new Date().toISOString();
        entity.createdBy = actorContext ? actorContext.userId : "SYSTEM";
        entity.lastModifiedTimestamp = entity.createdTimestamp;
        entity.lastModifiedBy = entity.createdBy;
        entity.rowVersion = 1;
        entity.recordStatus = "ACTIVE";
      }
      
      const newRow = this.mapObjectToRow(entity, headerMap);
      sheet.appendRow(newRow);
      
      // Log audit trail event
      this.writeAuditLog(actorContext, "CREATE", entity[this.pkName], null, JSON.stringify(entity));
      
      return entity;
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Updates existing entry with rowVersion optimistic concurrency protection
   */
  update(entity, expectedRowVersion, actorContext) {
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
    } catch (e) {
      throw new Error("ERR_DB_201: Lock contention timeout on update operation.");
    }
    
    try {
      const sheet = this.getSheet();
      if (sheet.getLastRow() <= 1) throw new Error("ERR_DB_NOT_FOUND");
      
      const headerMap = this.getHeaderMap(sheet);
      const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
      
      const pkColIdx = headerMap[this.pkName] - 1;
      const tenantColIdx = headerMap["tenantId"] ? headerMap["tenantId"] - 1 : -1;
      const id = entity[this.pkName];
      let rowIndex = -1;
      
      for (let i = 0; i < data.length; i++) {
        if (data[i][pkColIdx] === id) {
          if (tenantColIdx !== -1 && actorContext && actorContext.tenantId &&
              data[i][tenantColIdx] !== actorContext.tenantId) {
            throw new Error("ERR_TENANT_ISOLATION_VIOLATION: Update boundary breach blocked.");
          }
          rowIndex = i + 2; // Rows are 1-indexed, starting from 2
          const currentVersion = parseInt(data[i][headerMap["rowVersion"] - 1]) || 1;
          
          // Verify concurrency token rowVersion
          if (expectedRowVersion !== undefined && currentVersion !== expectedRowVersion) {
            throw new Error("ERR_CONCURRENCY_409: Concurrency conflict. Expected version " + expectedRowVersion + " but found " + currentVersion);
          }
          break;
        }
      }
      
      if (rowIndex === -1) {
        throw new Error("ERR_RECORD_NOT_FOUND: Failed to locate target record for updates.");
      }
      
      // Track previous values for auditing
      const previousRow = data[rowIndex - 2];
      const previousObj = this.mapRowToObject(previousRow, headerMap);
      
      // Update metadata
      if (this.isMutable) {
        entity.lastModifiedTimestamp = new Date().toISOString();
        entity.lastModifiedBy = actorContext ? actorContext.userId : "SYSTEM";
        entity.rowVersion = (parseInt(expectedRowVersion) || 1) + 1;
      }
      
      const updatedRow = this.mapObjectToRow(entity, headerMap);
      sheet.getRange(rowIndex, 1, 1, updatedRow.length).setValues([updatedRow]);
      
      // Write log
      this.writeAuditLog(actorContext, "UPDATE", id, JSON.stringify(previousObj), JSON.stringify(entity));
      
      return entity;
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Soft deletes transaction rows
   */
  archive(id, expectedRowVersion, actorContext) {
    const entity = this.findById(id, actorContext ? actorContext.tenantId : null);
    if (!entity) throw new Error("ERR_RECORD_NOT_FOUND");
    
    entity.recordStatus = "DELETED";
    entity.deletedTimestamp = new Date().toISOString();
    entity.deletedBy = actorContext ? actorContext.userId : "SYSTEM";
    
    return this.update(entity, expectedRowVersion, actorContext);
  }

  /**
   * Utility to write to append-only audit log sheet
   */
  writeAuditLog(actor, action, entityId, previousVal, newVal) {
    if (this.sheetName === "audit_logs") return; // Prevent loops
    
    try {
      const ssId = CMPE_ENVIRONMENT.getSpreadsheetId();
      const sheet = SpreadsheetApp.openById(ssId).getSheetByName("audit_logs");
      if (!sheet) return;
      
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1).getValues()[0];
      const headerMap = {};
      headers.forEach((h, i) => headerMap[h] = i + 1);
      
      const log = {
        auditLogId: Utilities.getUuid(),
        tenantId: actor ? actor.tenantId : "SYSTEM",
        timestamp: new Date().toISOString(),
        actorUserId: actor ? actor.userId : "SYSTEM",
        actorRoleCodesJson: actor ? JSON.stringify(actor.roles || []) : "[]",
        action: action,
        entityType: this.sheetName,
        entityId: entityId,
        previousValueJson: previousVal || "",
        newValueJson: newVal || "",
        reason: "System Automated State Transaction",
        requestId: Utilities.getUuid(),
        correlationId: "",
        deviceId: "SERVER_GAS",
        ipAddressHash: "SHA256_LOCAL",
        result: "SUCCESS"
      };
      
      const row = [];
      const keys = Object.keys(headerMap).sort((a, b) => headerMap[a] - headerMap[b]);
      keys.forEach(key => {
        row.push(log[key] === undefined || log[key] === null ? "" : log[key]);
      });
      
      sheet.appendRow(row);
    } catch (e) {
      Logger.log("Failed to write audit logs: " + e.toString());
    }
  }
}
