/**
 * Competition Platform Engineering Standards (CPES)
 * Stage 5 - Registration Repositories
 */

function findRegistrationChildren_(repo, regId, tenantId) {
  const sheet = repo.getSheet();
  if (sheet.getLastRow() <= 1) return [];
  const hm = repo.getHeaderMap(sheet);
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  return data.filter(row =>
    row[hm.registrationId - 1] === regId &&
    (!hm.tenantId || row[hm.tenantId - 1] === tenantId) &&
    (!hm.recordStatus || row[hm.recordStatus - 1] !== "DELETED")
  ).map(row => repo.mapRowToObject(row, hm));
}

class RegistrationRepository extends BaseRepository {
  constructor() {
    super("registrations");
  }

  findBySchool(schoolId, tenantId) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return [];
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const schoolCol = headerMap["schoolId"] - 1;
    const tenantCol = headerMap["tenantId"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    const list = [];
    data.forEach(row => {
      if (row[schoolCol] === schoolId && row[tenantCol] === tenantId && row[statusCol] !== "DELETED") {
        list.push(this.mapRowToObject(row, headerMap));
      }
    });
    return list;
  }

  /**
   * Reviews one or more submitted registrations in one lock, one table read,
   * one table write and batched history/audit appends.
   */
  reviewTransitions(items, nextStatus, reason, actor) {
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sheet = this.getSheet();
      if (!sheet || sheet.getLastRow() <= 1) return [];
      const values = sheet.getDataRange().getValues();
      const headers = values[0].map(String);
      const index = {};
      const headerMap = {};
      headers.forEach((header, column) => {
        if (header) {
          index[header] = column;
          headerMap[header] = column + 1;
        }
      });
      const requested = {};
      (items || []).forEach(item => { requested[item.registrationId] = item; });
      const now = new Date().toISOString();
      const updated = [];
      const historyRows = [];
      const auditEntries = [];

      for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
        const row = values[rowIndex];
        const registrationId = row[index.registrationId];
        const request = requested[registrationId];
        if (!request) continue;
        if (row[index.tenantId] !== actor.tenantId) {
          throw new Error("ERR_TENANT_ISOLATION_VIOLATION");
        }
        if (row[index.registrationStatus] !== "SUBMITTED") {
          throw new Error("ERR_STATE_VIOLATION: Registration " + registrationId + " is no longer SUBMITTED.");
        }
        const currentVersion = parseInt(row[index.rowVersion]) || 1;
        if (currentVersion !== parseInt(request.rowVersion)) {
          throw new Error("ERR_CONCURRENCY_409: Registration " + registrationId + " was changed by another user.");
        }
        const previous = this.mapRowToObject(row.slice(), headerMap);
        row[index.registrationStatus] = nextStatus;
        if (nextStatus === "APPROVED") {
          row[index.approvalTimestamp] = now;
          row[index.approvedBy] = actor.userId;
        } else {
          row[index.rejectionTimestamp] = now;
          row[index.rejectedBy] = actor.userId;
          row[index.rejectionReason] = reason;
        }
        row[index.lastModifiedTimestamp] = now;
        row[index.lastModifiedBy] = actor.userId;
        row[index.rowVersion] = currentVersion + 1;
        const current = this.mapRowToObject(row, headerMap);
        updated.push(current);
        historyRows.push({
          registrationHistoryId: CMPE_UTILITIES.generateUuid(),
          registrationId: registrationId,
          actionType: nextStatus,
          changeLogJson: JSON.stringify(nextStatus === "APPROVED"
            ? { approvedBy: actor.userId }
            : { rejectedBy: actor.userId, reason: reason }),
          tenantId: actor.tenantId,
          createdTimestamp: now,
          createdBy: actor.userId,
          lastModifiedTimestamp: now,
          lastModifiedBy: actor.userId,
          rowVersion: 1,
          recordStatus: "ACTIVE"
        });
        auditEntries.push({ id: registrationId, previous: previous, current: current });
        delete requested[registrationId];
      }
      const missing = Object.keys(requested);
      if (missing.length) throw new Error("ERR_REG_NOT_FOUND: " + missing.join(", "));

      sheet.getRange(2, 1, values.length - 1, headers.length).setValues(values.slice(1));
      this.appendObjectBatch_("registration_history", historyRows);
      this.appendReviewAuditBatch_(auditEntries, nextStatus, actor, now);
      return updated;
    } finally {
      lock.releaseLock();
    }
  }

  appendObjectBatch_(sheetName, objects) {
    if (!objects.length) return;
    const sheet = getCmpeSheet_(sheetName);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    const rows = objects.map(object => headers.map(header =>
      object[header] === undefined || object[header] === null ? "" : object[header]
    ));
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
  }

  appendReviewAuditBatch_(entries, action, actor, timestamp) {
    if (!entries.length) return;
    const rows = entries.map(entry => ({
      auditLogId: CMPE_UTILITIES.generateUuid(),
      tenantId: actor.tenantId,
      timestamp: timestamp,
      actorUserId: actor.userId,
      actorRoleCodesJson: JSON.stringify(actor.roles || []),
      action: action,
      entityType: "registrations",
      entityId: entry.id,
      previousValueJson: JSON.stringify(entry.previous),
      newValueJson: JSON.stringify(entry.current),
      reason: "Registration review transaction",
      requestId: CMPE_UTILITIES.generateUuid(),
      correlationId: "",
      deviceId: "SERVER_GAS",
      ipAddressHash: "SHA256_LOCAL",
      result: "SUCCESS"
    }));
    this.appendObjectBatch_("audit_logs", rows);
  }
}

class RegistrationMemberRepository extends BaseRepository {
  constructor() {
    super("registration_members");
  }

  findByRegistration(regId, tenantId) {
    return findRegistrationChildren_(this, regId, tenantId);
    /*
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return [];
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const regCol = headerMap["registrationId"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    const list = [];
    data.forEach(row => {
      if (row[regCol] === regId && row[statusCol] !== "DELETED") {
        list.push(this.mapRowToObject(row, headerMap));
      }
    });
    return list;*/
  }
}

class CoachRepository extends BaseRepository {
  constructor() {
    super("coaches");
  }

  findByRegistration(regId, tenantId) {
    return findRegistrationChildren_(this, regId, tenantId);
    /*
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return [];
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const regCol = headerMap["registrationId"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    const list = [];
    data.forEach(row => {
      if (row[regCol] === regId && row[statusCol] !== "DELETED") {
        list.push(this.mapRowToObject(row, headerMap));
      }
    });
    return list;*/
  }
}

class SubstituteRepository extends BaseRepository {
  constructor() {
    super("substitutes");
  }

  findByRegistration(regId, tenantId) {
    return findRegistrationChildren_(this, regId, tenantId);
    /*
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return [];
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const regCol = headerMap["registrationId"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    const list = [];
    data.forEach(row => {
      if (row[regCol] === regId && row[statusCol] !== "DELETED") {
        list.push(this.mapRowToObject(row, headerMap));
      }
    });
    return list;*/
  }
}

class RegistrationAttachmentRepository extends BaseRepository {
  constructor() {
    super("attachments");
  }

  findByRegistration(regId, tenantId) {
    return findRegistrationChildren_(this, regId, tenantId);
    /*
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return [];
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const regCol = headerMap["registrationId"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    const list = [];
    data.forEach(row => {
      if (row[regCol] === regId && row[statusCol] !== "DELETED") {
        list.push(this.mapRowToObject(row, headerMap));
      }
    });
    return list;*/
  }
}

class RegistrationHistoryRepository extends BaseRepository {
  constructor() {
    super("registration_history");
  }

  findByRegistration(regId, tenantId) {
    return findRegistrationChildren_(this, regId, tenantId);
    /*
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return [];
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const regCol = headerMap["registrationId"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    const list = [];
    data.forEach(row => {
      if (row[regCol] === regId && row[statusCol] !== "DELETED") {
        list.push(this.mapRowToObject(row, headerMap));
      }
    });
    return list;*/
  }
}
