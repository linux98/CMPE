/**
 * Competition Platform Engineering Standards (CPES)
 * Stage 10 - Analytics & Reporting Repositories
 */

class DashboardCacheRepository extends BaseRepository {
  constructor() {
    super("dashboard_cache");
  }

  findByCode(code, tenantId) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return null;
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const codeCol = headerMap["dashboardCode"] - 1;
    const tenantCol = headerMap["tenantId"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    for (let i = 0; i < data.length; i++) {
      if (data[i][codeCol] === code && data[i][tenantCol] === tenantId && data[i][statusCol] !== "DELETED") {
        return this.mapRowToObject(data[i], headerMap);
      }
    }
    return null;
  }
}

class LeaderboardCacheRepository extends BaseRepository {
  constructor() {
    super("leaderboard_cache");
  }

  findByType(type, tenantId) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return null;
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const typeCol = headerMap["leaderboardType"] - 1;
    const tenantCol = headerMap["tenantId"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    for (let i = 0; i < data.length; i++) {
      if (data[i][typeCol] === type && data[i][tenantCol] === tenantId && data[i][statusCol] !== "DELETED") {
        return this.mapRowToObject(data[i], headerMap);
      }
    }
    return null;
  }
}

class StatisticRepository extends BaseRepository {
  constructor() {
    super("statistics");
  }

  findByMetric(metricCode, tenantId) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return null;
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const metricCol = headerMap["metricCode"] - 1;
    const tenantCol = headerMap["tenantId"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    for (let i = 0; i < data.length; i++) {
      if (data[i][metricCol] === metricCode && data[i][tenantCol] === tenantId && data[i][statusCol] !== "DELETED") {
        return this.mapRowToObject(data[i], headerMap);
      }
    }
    return null;
  }
}

class ReportRepository extends BaseRepository {
  constructor() {
    super("reports");
  }
}
