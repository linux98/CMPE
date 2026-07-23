/**
 * Competition Platform Engineering Standards (CPES)
 * Stage 6 - Competition Operations Repositories
 */

class JudgeRepository extends BaseRepository {
  constructor() {
    super("judges");
  }

  findByCode(code, tenantId) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return null;
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const codeCol = headerMap["judgeCode"] - 1;
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

class JudgeAssignmentRepository extends BaseRepository {
  constructor() {
    super("judge_assignments");
  }

  findByJudge(judgeId, tenantId) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return [];
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const judgeCol = headerMap["judgeId"] - 1;
    const tenantCol = headerMap["tenantId"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    const list = [];
    data.forEach(row => {
      if (row[judgeCol] === judgeId && row[tenantCol] === tenantId && row[statusCol] !== "DELETED") {
        list.push(this.mapRowToObject(row, headerMap));
      }
    });
    return list;
  }

  findByRound(roundId, tenantId) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return [];
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const roundCol = headerMap["competitionRoundId"] - 1;
    const tenantCol = headerMap["tenantId"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    const list = [];
    data.forEach(row => {
      if (row[roundCol] === roundId && row[tenantCol] === tenantId && row[statusCol] !== "DELETED") {
        list.push(this.mapRowToObject(row, headerMap));
      }
    });
    return list;
  }
}

class CheckInRepository extends BaseRepository {
  constructor() {
    super("checkin_logs");
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

class CompetitionRoomRepository extends BaseRepository {
  constructor() {
    super("competition_rooms");
  }

  findByVenue(venueId, tenantId) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return [];
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const venueCol = headerMap["venueId"] - 1;
    const tenantCol = headerMap["tenantId"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    const list = [];
    data.forEach(row => {
      if (row[venueCol] === venueId && row[tenantCol] === tenantId && row[statusCol] !== "DELETED") {
        list.push(this.mapRowToObject(row, headerMap));
      }
    });
    return list;
  }
}

class RoomScheduleRepository extends BaseRepository {
  constructor() {
    super("room_schedules");
  }

  findByRoom(roomId, tenantId) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return [];
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const roomCol = headerMap["competitionRoomId"] - 1;
    const tenantCol = headerMap["tenantId"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    const list = [];
    data.forEach(row => {
      if (row[roomCol] === roomId && row[tenantCol] === tenantId && row[statusCol] !== "DELETED") {
        list.push(this.mapRowToObject(row, headerMap));
      }
    });
    return list;
  }
}

class AnnouncementRepository extends BaseRepository {
  constructor() {
    super("announcements");
  }

  findActiveAnnouncements(tenantId) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return [];
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const tenantCol = headerMap["tenantId"] - 1;
    const statusCol = headerMap["announcementStatus"] - 1;
    const recStatusCol = headerMap["recordStatus"] - 1;
    
    const list = [];
    data.forEach(row => {
      if (row[tenantCol] === tenantId && row[statusCol] === "PUBLISHED" && row[recStatusCol] !== "DELETED") {
        list.push(this.mapRowToObject(row, headerMap));
      }
    });
    return list;
  }
}
