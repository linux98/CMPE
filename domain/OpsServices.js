/**
 * Competition Platform Engineering Standards (CPES)
 * Stage 6 - Competition Operations Services
 */

class JudgeApplicationService {
  constructor(judgeRepo) {
    this.judgeRepo = judgeRepo;
  }

  createJudge(payload, actor) {
    const code = payload.judgeCode;
    const existing = this.judgeRepo.findByCode(code, actor.tenantId);
    if (existing) {
      throw new Error("ERR_DUPLICATE_JUDGE_CODE: A judge with this code already exists in the tenant.");
    }
    
    const judge = new JudgeEntity(payload);
    judge.judgeId = payload.judgeId || CMPE_UTILITIES.generateUuid();
    judge.judgeStatus = "ACTIVE";
    judge.rowVersion = 1;
    
    return this.judgeRepo.create(judge, actor);
  }
}

class JudgeAssignmentService {
  constructor(assignmentRepo, judgeRepo, conflictSvc) {
    this.assignmentRepo = assignmentRepo;
    this.judgeRepo = judgeRepo;
    this.conflictSvc = conflictSvc;
  }

  assignJudge(payload, actor) {
    const judge = this.judgeRepo.findById(payload.judgeId, actor.tenantId);
    if (!judge || judge.judgeStatus !== "ACTIVE") {
      throw new Error("ERR_JUDGE_NOT_ACTIVE: The requested judge is not active or suspended.");
    }

    // Chief Judge constraint checks:
    if (payload.judgeRole === "CHIEF_JUDGE") {
      const activeAssignments = this.assignmentRepo.findByRound(payload.competitionRoundId, actor.tenantId);
      const chiefExists = activeAssignments.some(a => a.judgeRole === "CHIEF_JUDGE" && a.assignmentStatus === "ACTIVE");
      if (chiefExists) {
        throw new Error("ERR_CHIEF_JUDGE_EXISTS: A Chief Judge is already assigned to this competition round.");
      }
    }

    // Time overlap conflict check:
    const conflicts = this.conflictSvc.checkJudgeConflicts(payload.judgeId, payload.assignmentStartTimestamp, payload.assignmentEndTimestamp, actor.tenantId);
    if (conflicts.hasConflict) {
      throw new Error("ERR_JUDGE_OVERLAP: Judge has conflicting overlapping assignments.");
    }

    const assignment = new JudgeAssignmentEntity(payload);
    assignment.judgeAssignmentId = payload.judgeAssignmentId || CMPE_UTILITIES.generateUuid();
    assignment.assignmentStatus = "ACTIVE";
    assignment.rowVersion = 1;

    return this.assignmentRepo.create(assignment, actor);
  }
}

class JudgeConflictService {
  constructor(assignmentRepo) {
    this.assignmentRepo = assignmentRepo;
  }

  checkJudgeConflicts(judgeId, start, end, tenantId) {
    const assignments = this.assignmentRepo.findByJudge(judgeId, tenantId);
    const hasOverlap = assignments.some(a => {
      if (a.assignmentStatus !== "ACTIVE") return false;
      
      // Parse dates and check overlap
      const aStart = new Date(a.assignmentStartTimestamp).getTime();
      const aEnd = new Date(a.assignmentEndTimestamp).getTime();
      const qStart = new Date(start).getTime();
      const qEnd = new Date(end).getTime();
      
      return (qStart < aEnd && qEnd > aStart);
    });

    return {
      hasConflict: hasOverlap
    };
  }
}

class CompetitionRoomService {
  constructor(roomRepo) {
    this.roomRepo = roomRepo;
  }

  createRoom(payload, actor) {
    const room = new CompetitionRoomEntity(payload);
    room.competitionRoomId = payload.competitionRoomId || CMPE_UTILITIES.generateUuid();
    room.roomStatus = "ACTIVE";
    room.rowVersion = 1;
    
    return this.roomRepo.create(room, actor);
  }
}

class ScheduleApplicationService {
  constructor(scheduleRepo, conflictSvc) {
    this.scheduleRepo = scheduleRepo;
    this.conflictSvc = conflictSvc;
  }

  createScheduleSlot(payload, actor) {
    // Validate end date comes after start date
    const start = new Date(payload.startTimestamp).getTime();
    const end = new Date(payload.endTimestamp).getTime();
    if (end <= start) {
      throw new Error("ERR_INVALID_SCHEDULE_PERIOD: End timestamp must be later than start timestamp.");
    }

    // Room overlap check:
    const conflicts = this.conflictSvc.checkRoomConflicts(payload.competitionRoomId, payload.startTimestamp, payload.endTimestamp, actor.tenantId);
    if (conflicts.hasConflict) {
      throw new Error("ERR_ROOM_OVERLAP: The selected room is already booked for this time period.");
    }

    const slot = new RoomScheduleEntity(payload);
    slot.roomScheduleId = payload.roomScheduleId || CMPE_UTILITIES.generateUuid();
    slot.scheduleStatus = "CONFIRMED";
    slot.rowVersion = 1;

    return this.scheduleRepo.create(slot, actor);
  }
}

class ScheduleConflictService {
  constructor(scheduleRepo) {
    this.scheduleRepo = scheduleRepo;
  }

  checkRoomConflicts(roomId, start, end, tenantId) {
    const schedules = this.scheduleRepo.findByRoom(roomId, tenantId);
    const hasOverlap = schedules.some(s => {
      if (s.scheduleStatus !== "CONFIRMED") return false;
      
      const sStart = new Date(s.startTimestamp).getTime();
      const sEnd = new Date(s.endTimestamp).getTime();
      const qStart = new Date(start).getTime();
      const qEnd = new Date(end).getTime();
      
      return (qStart < sEnd && qEnd > sStart);
    });

    return {
      hasConflict: hasOverlap
    };
  }
}

class OperationalReadinessService {
  constructor(regRepo, roomRepo, assignmentRepo) {
    this.regRepo = regRepo;
    this.roomRepo = roomRepo;
    this.assignmentRepo = assignmentRepo;
  }

  validateReadiness(competitionId, tenantId) {
    const checks = [];
    let ready = true;

    // Check 1: Rooms are configured
    const roomsSheet = this.roomRepo.getSheet();
    let roomsCount = 0;
    if (roomsSheet.getLastRow() > 1) {
      const data = roomsSheet.getRange(2, 1, roomsSheet.getLastRow() - 1, roomsSheet.getLastColumn()).getValues();
      const compCol = this.roomRepo.getHeaderMap(roomsSheet)["competitionId"] - 1;
      const statusCol = this.roomRepo.getHeaderMap(roomsSheet)["recordStatus"] - 1;
      data.forEach(row => {
        if (row[compCol] === competitionId && row[statusCol] !== "DELETED") roomsCount++;
      });
    }
    
    if (roomsCount === 0) {
      ready = false;
      checks.push({ checkCode: "ROOMS_CONFIGURED", status: "NOT_READY", explanation: "No competition rooms are configured." });
    } else {
      checks.push({ checkCode: "ROOMS_CONFIGURED", status: "READY", explanation: `${roomsCount} rooms configured.` });
    }

    // Check 2: At least one approved registration exists.
    const regSheet = this.regRepo.getSheet();
    let approvedCount = 0;
    if (regSheet.getLastRow() > 1) {
      const hm = this.regRepo.getHeaderMap(regSheet);
      const rows = regSheet.getRange(2, 1, regSheet.getLastRow() - 1, regSheet.getLastColumn()).getValues();
      approvedCount = rows.filter(row =>
        row[hm.competitionId - 1] === competitionId &&
        row[hm.tenantId - 1] === tenantId &&
        row[hm.registrationStatus - 1] === "APPROVED" &&
        row[hm.recordStatus - 1] !== "DELETED"
      ).length;
    }
    if (approvedCount === 0) {
      ready = false;
      checks.push({ checkCode: "APPROVED_REGISTRATIONS", status: "NOT_READY", explanation: "No approved registrations." });
    } else {
      checks.push({ checkCode: "APPROVED_REGISTRATIONS", status: "READY", explanation: `${approvedCount} approved registrations.` });
    }

    // Check 3: Active judge assignments exist.
    const assignmentSheet = this.assignmentRepo.getSheet();
    let assignmentCount = 0;
    if (assignmentSheet.getLastRow() > 1) {
      const hm = this.assignmentRepo.getHeaderMap(assignmentSheet);
      const rows = assignmentSheet.getRange(2, 1, assignmentSheet.getLastRow() - 1, assignmentSheet.getLastColumn()).getValues();
      assignmentCount = rows.filter(row =>
        row[hm.competitionId - 1] === competitionId &&
        row[hm.tenantId - 1] === tenantId &&
        row[hm.assignmentStatus - 1] === "ACTIVE" &&
        row[hm.recordStatus - 1] !== "DELETED"
      ).length;
    }
    if (assignmentCount === 0) {
      ready = false;
      checks.push({ checkCode: "JUDGES_ASSIGNED", status: "NOT_READY", explanation: "No active judge assignments." });
    } else {
      checks.push({ checkCode: "JUDGES_ASSIGNED", status: "READY", explanation: `${assignmentCount} active judge assignments.` });
    }

    return {
      status: ready ? "READY" : "NOT_READY",
      checks: checks
    };
  }
}

class CheckInApplicationService {
  constructor(checkinRepo, registrationRepo) {
    this.checkinRepo = checkinRepo;
    this.registrationRepo = registrationRepo;
  }

  resolveRegistration_(reference, tenantId) {
    const value = String(reference || "").trim().toLowerCase();
    if (!value) return null;
    return this.registrationRepo.findAll(tenantId).find(registration =>
      String(registration.registrationId || "").toLowerCase() === value ||
      String(registration.registrationNumber || "").toLowerCase() === value
    ) || null;
  }

  dashboard(tenantId) {
    const lookup = getRegistrationDisplayLookup_();
    const registrations = this.registrationRepo.findAll(tenantId)
      .filter(item => ["APPROVED", "CHECKED_IN", "COMPETED", "COMPLETED"].indexOf(item.registrationStatus) !== -1);
    const logs = this.checkinRepo.findAll(tenantId);
    const reversedIds = {};
    logs.forEach(log => {
      if (log.checkinStatus === "REVERSED" && log.reversalOfCheckinLogId) {
        reversedIds[log.reversalOfCheckinLogId] = true;
      }
    });
    const activeByRegistration = {};
    logs.filter(log => log.checkinStatus === "CHECKED_IN" && !reversedIds[log.checkinLogId])
      .sort((a, b) => String(b.checkinTimestamp).localeCompare(String(a.checkinTimestamp)))
      .forEach(log => {
        if (!activeByRegistration[log.registrationId]) activeByRegistration[log.registrationId] = log;
      });
    const rows = registrations.map(registration => {
      const config = lookup.configs[registration.competitionCategoryConfigId] || [];
      const activeLog = activeByRegistration[registration.registrationId] || null;
      return {
        registrationId: registration.registrationId,
        registrationNumber: registration.registrationNumber || registration.registrationId,
        schoolNameTh: lookup.schools[registration.schoolId] || registration.schoolId || "ไม่ระบุโรงเรียน",
        activityNameTh: lookup.categories[config[0]] || "ไม่ระบุกิจกรรม",
        educationLevelNameTh: lookup.levels[config[1]] || "",
        competitionId: registration.competitionId,
        checkedIn: Boolean(activeLog),
        checkinLogId: activeLog ? activeLog.checkinLogId : "",
        checkinTimestamp: activeLog ? activeLog.checkinTimestamp : ""
      };
    });
    rows.sort((a, b) => Number(a.checkedIn) - Number(b.checkedIn) ||
      String(a.registrationNumber).localeCompare(String(b.registrationNumber), "th"));
    return {
      summary: {
        total: rows.length,
        checkedIn: rows.filter(row => row.checkedIn).length,
        pending: rows.filter(row => !row.checkedIn).length
      },
      rows: rows
    };
  }

  recordCheckIn(payload, actor) {
    const registration = this.resolveRegistration_(payload.registrationId || payload.registrationNumber, actor.tenantId);
    if (!registration) throw new Error("ERR_REGISTRATION_NOT_FOUND");
    if (["APPROVED", "CHECKED_IN", "COMPETED", "COMPLETED"].indexOf(registration.registrationStatus) === -1) {
      throw new Error("ERR_REGISTRATION_NOT_APPROVED");
    }
    const active = this.checkinRepo.findByRegistration(registration.registrationId, actor.tenantId);
    const reversedIds = {};
    active.forEach(log => {
      if (log.checkinStatus === "REVERSED") reversedIds[log.reversalOfCheckinLogId] = true;
    });
    if (active.some(log => log.checkinStatus === "CHECKED_IN" && !reversedIds[log.checkinLogId])) {
      throw new Error("ERR_ALREADY_CHECKED_IN");
    }
    const normalized = Object.assign({}, payload, {
      tenantId: actor.tenantId,
      competitionId: registration.competitionId,
      registrationId: registration.registrationId,
      subjectId: registration.registrationId
    });
    const log = new CheckInLogEntity(normalized);
    log.checkinLogId = payload.checkinLogId || CMPE_UTILITIES.generateUuid();
    log.checkinStatus = "CHECKED_IN";
    log.checkinTimestamp = new Date().toISOString();
    log.recordedBy = actor.userId;
    log.rowVersion = 1;

    return this.checkinRepo.create(log, actor);
  }

  reverseCheckIn(checkinLogId, reason, actor) {
    if (!reason) throw new Error("ERR_REVERSAL_REASON_REQUIRED");
    
    const oldLog = this.checkinRepo.findById(checkinLogId, actor.tenantId);
    if (!oldLog) throw new Error("ERR_LOG_NOT_FOUND");
    
    const reverse = new CheckInLogEntity(oldLog);
    reverse.checkinLogId = CMPE_UTILITIES.generateUuid();
    reverse.checkinStatus = "REVERSED";
    reverse.reversalOfCheckinLogId = checkinLogId;
    reverse.reversalReason = reason;
    reverse.checkinTimestamp = new Date().toISOString();
    reverse.recordedBy = actor.userId;
    reverse.rowVersion = 1;
    
    return this.checkinRepo.create(reverse, actor);
  }
}

class AnnouncementApplicationService {
  constructor(announcementRepo) {
    this.announcementRepo = announcementRepo;
  }

  createAnnouncement(payload, actor) {
    const ann = new AnnouncementEntity(payload);
    ann.announcementId = payload.announcementId || CMPE_UTILITIES.generateUuid();
    ann.announcementStatus = "PUBLISHED";
    ann.rowVersion = 1;
    
    return this.announcementRepo.create(ann, actor);
  }
}
