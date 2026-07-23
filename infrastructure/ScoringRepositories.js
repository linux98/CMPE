/**
 * Competition Platform Engineering Standards (CPES)
 * Stage 7 - Scoring & Evaluation Repositories
 */

class ScorecardRepository extends BaseRepository {
  constructor() {
    super("scorecards");
  }

  findByRegistration(regId, tenantId) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return [];
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const regCol = headerMap["registrationId"] - 1;
    const tenantCol = headerMap["tenantId"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    const list = [];
    data.forEach(row => {
      if (row[regCol] === regId && row[tenantCol] === tenantId && row[statusCol] !== "DELETED") {
        list.push(this.mapRowToObject(row, headerMap));
      }
    });
    return list;
  }
}

class ScoreDetailRepository extends BaseRepository {
  constructor() {
    super("score_details");
  }

  findByScorecard(scorecardId, tenantId) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return [];
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const scCol = headerMap["scorecardId"] - 1;
    const tenantCol = headerMap["tenantId"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    const list = [];
    data.forEach(row => {
      if (row[scCol] === scorecardId && row[tenantCol] === tenantId && row[statusCol] !== "DELETED") {
        list.push(this.mapRowToObject(row, headerMap));
      }
    });
    return list;
  }
}

class ScoreSummaryRepository extends BaseRepository {
  constructor() {
    super("score_summary");
  }

  findByRegistration(regId, tenantId) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return null;
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const regCol = headerMap["registrationId"] - 1;
    const tenantCol = headerMap["tenantId"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    for (let i = 0; i < data.length; i++) {
      if (data[i][regCol] === regId && data[i][tenantCol] === tenantId && data[i][statusCol] !== "DELETED") {
        return this.mapRowToObject(data[i], headerMap);
      }
    }
    return null;
  }
}

class ScoreLockHistoryRepository extends BaseRepository {
  constructor() {
    super("score_lock_history");
  }
}

class AppealRepository extends BaseRepository {
  constructor() {
    super("appeals");
  }

  findByRegistration(regId, tenantId) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return [];
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const regCol = headerMap["registrationId"] - 1;
    const tenantCol = headerMap["tenantId"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    const list = [];
    data.forEach(row => {
      if (row[regCol] === regId && row[tenantCol] === tenantId && row[statusCol] !== "DELETED") {
        list.push(this.mapRowToObject(row, headerMap));
      }
    });
    return list;
  }
}

class RankingRepository extends BaseRepository {
  constructor() {
    super("rankings");
  }
}

class MedalRepository extends BaseRepository {
  constructor() {
    super("medals");
  }

  findByRegistration(regId, tenantId) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return null;
    const hm = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const row = data.find(r =>
      r[hm.registrationId - 1] === regId &&
      (!hm.tenantId || r[hm.tenantId - 1] === tenantId) &&
      (!hm.recordStatus || r[hm.recordStatus - 1] !== "DELETED")
    );
    return row ? this.mapRowToObject(row, hm) : null;
  }
}

class AwardRepository extends BaseRepository {
  constructor() {
    super("awards");
  }
}

class TrophyRepository extends BaseRepository {
  constructor() {
    super("trophies");
  }
}
