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
