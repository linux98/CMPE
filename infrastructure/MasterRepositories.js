/**
 * Competition Platform Engineering Standards (CPES)
 * Master Data Bounded Context - Specialized Repositories
 */

class TenantRepository extends BaseRepository {
  constructor() {
    super("tenants");
  }

  findAll() {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return [];
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const statusCol = headerMap["recordStatus"] - 1;
    
    const list = [];
    data.forEach(row => {
      if (row[statusCol] !== "DELETED") {
        list.push(this.mapRowToObject(row, headerMap));
      }
    });
    return list;
  }
}

class AcademicYearRepository extends BaseRepository {
  constructor() {
    super("academic_years");
  }

  findAll() {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return [];
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const statusCol = headerMap["recordStatus"] - 1;
    
    const list = [];
    data.forEach(row => {
      if (row[statusCol] !== "DELETED") {
        list.push(this.mapRowToObject(row, headerMap));
      }
    });
    return list;
  }

  findCurrent() {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return null;
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const isCurrentCol = headerMap["isCurrent"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if ((row[isCurrentCol] === true || row[isCurrentCol] === "TRUE" || row[isCurrentCol] === "true") && row[statusCol] !== "DELETED") {
        return this.mapRowToObject(row, headerMap);
      }
    }
    return null;
  }

  /**
   * Atomics setter. Unsets any previous current years and sets target year as current.
   */
  setCurrent(academicYearId, tenantId) {
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
    } catch (e) {
      throw new Error("Lock contention on setting current academic year");
    }
    
    try {
      const sheet = this.getSheet();
      if (sheet.getLastRow() <= 1) return;
      
      const headerMap = this.getHeaderMap(sheet);
      const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
      
      const idCol = headerMap["academicYearId"] - 1;
      const isCurrentCol = headerMap["isCurrent"] - 1;
      const statusCol = headerMap["recordStatus"] - 1;
      
      for (let i = 0; i < data.length; i++) {
        const rowIdx = i + 2;
        const isTarget = data[i][idCol] === academicYearId;
        const currentVal = data[i][isCurrentCol] === true || data[i][isCurrentCol] === "TRUE" || data[i][isCurrentCol] === "true";
        
        if (isTarget && data[i][statusCol] !== "DELETED") {
          sheet.getRange(rowIdx, isCurrentCol + 1).setValue("true");
          sheet.getRange(rowIdx, headerMap["rowVersion"]).setValue((parseInt(data[i][headerMap["rowVersion"] - 1]) || 1) + 1);
        } else if (currentVal) {
          sheet.getRange(rowIdx, isCurrentCol + 1).setValue("false");
          sheet.getRange(rowIdx, headerMap["rowVersion"]).setValue((parseInt(data[i][headerMap["rowVersion"] - 1]) || 1) + 1);
        }
      }
    } finally {
      lock.releaseLock();
    }
  }
}

class ProvinceRepository extends BaseRepository {
  constructor() {
    super("provinces");
  }

  findAll() {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return [];
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const statusCol = headerMap["recordStatus"] - 1;
    
    const list = [];
    data.forEach(row => {
      if (row[statusCol] !== "DELETED") {
        list.push(this.mapRowToObject(row, headerMap));
      }
    });
    return list;
  }

  findByCode(code) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return null;
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const codeCol = headerMap["provinceCode"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row[codeCol] === code && row[statusCol] !== "DELETED") {
        return this.mapRowToObject(row, headerMap);
      }
    }
    return null;
  }
}

class DistrictRepository extends BaseRepository {
  constructor() {
    super("districts");
  }

  findByProvince(provinceId) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return [];
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const provCol = headerMap["provinceId"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    const list = [];
    data.forEach(row => {
      if (row[provCol] === provinceId && row[statusCol] !== "DELETED") {
        list.push(this.mapRowToObject(row, headerMap));
      }
    });
    return list;
  }

  findByCode(code) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return null;
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const codeCol = headerMap["districtCode"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row[codeCol] === code && row[statusCol] !== "DELETED") {
        return this.mapRowToObject(row, headerMap);
      }
    }
    return null;
  }
}

class SchoolRepository extends BaseRepository {
  constructor() {
    super("schools");
  }

  findByTenant(tenantId) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return [];
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const tenantCol = headerMap["tenantId"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    const list = [];
    data.forEach(row => {
      if (row[tenantCol] === tenantId && row[statusCol] !== "DELETED") {
        list.push(this.mapRowToObject(row, headerMap));
      }
    });
    return list;
  }

  findByCode(code, tenantId) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return null;
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const pkCol = headerMap[this.pkName] - 1;
    const tenantCol = headerMap["tenantId"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row[pkCol] === code && row[tenantCol] === tenantId && row[statusCol] !== "DELETED") {
        return this.mapRowToObject(row, headerMap);
      }
    }
    return null;
  }

  search(query, tenantId) {
    const list = this.findByTenant(tenantId);
    if (!query) return list;
    
    const q = query.trim().toLowerCase();
    return list.filter(s => {
      return (s.nameTh || "").toLowerCase().indexOf(q) !== -1 ||
             (s.nameEn || "").toLowerCase().indexOf(q) !== -1 ||
             (s.schoolId || "").toLowerCase().indexOf(q) !== -1;
    });
  }
}

class EducationLevelRepository extends BaseRepository {
  constructor() {
    super("education_levels");
  }

  findAll() {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return [];
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const statusCol = headerMap["recordStatus"] - 1;
    
    const list = [];
    data.forEach(row => {
      if (row[statusCol] !== "DELETED") {
        list.push(this.mapRowToObject(row, headerMap));
      }
    });
    return list;
  }

  findByCode(code) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return null;
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const codeCol = headerMap["levelCode"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row[codeCol] === code && row[statusCol] !== "DELETED") {
        return this.mapRowToObject(row, headerMap);
      }
    }
    return null;
  }
}

class CompetitionTypeRepository extends BaseRepository {
  constructor() {
    super("competition_types");
  }

  findAll() {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return [];
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const statusCol = headerMap["recordStatus"] - 1;
    
    const list = [];
    data.forEach(row => {
      if (row[statusCol] !== "DELETED") {
        list.push(this.mapRowToObject(row, headerMap));
      }
    });
    return list;
  }

  findByCode(code) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return null;
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const codeCol = headerMap["typeCode"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row[codeCol] === code && row[statusCol] !== "DELETED") {
        return this.mapRowToObject(row, headerMap);
      }
    }
    return null;
  }
}

class CompetitionCategoryRepository extends BaseRepository {
  constructor() {
    super("competition_categories");
  }

  findByTenant(tenantId) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return [];
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const tenantCol = headerMap["tenantId"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    const list = [];
    data.forEach(row => {
      // Categories can be globally scoped (tenantId = 'SYSTEM' or '') or tenant scoped
      if ((row[tenantCol] === tenantId || row[tenantCol] === "SYSTEM" || !row[tenantCol]) && row[statusCol] !== "DELETED") {
        list.push(this.mapRowToObject(row, headerMap));
      }
    });
    return list;
  }

  findByCode(code, tenantId) {
    const list = this.findByTenant(tenantId);
    for (let i = 0; i < list.length; i++) {
      if (list[i].categoryCode === code) return list[i];
    }
    return null;
  }
}

class VenueRepository extends BaseRepository {
  constructor() {
    super("venues");
  }

  findByTenant(tenantId) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return [];
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const tenantCol = headerMap["tenantId"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    const list = [];
    data.forEach(row => {
      if (row[tenantCol] === tenantId && row[statusCol] !== "DELETED") {
        list.push(this.mapRowToObject(row, headerMap));
      }
    });
    return list;
  }
}
