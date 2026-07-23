/**
 * Competition Platform Engineering Standards (CPES)
 * Stage 6 - Competition Operations Domain Entities & Value Objects
 */

class JudgeEntity {
  constructor(data) {
    this.judgeId = data.judgeId || "";
    this.tenantId = data.tenantId || "";
    this.judgeCode = data.judgeCode || "";
    this.userId = data.userId || "";
    this.title = data.title || "";
    this.firstNameTh = data.firstNameTh || "";
    this.lastNameTh = data.lastNameTh || "";
    this.firstNameEn = data.firstNameEn || "";
    this.lastNameEn = data.lastNameEn || "";
    this.displayName = data.displayName || "";
    this.schoolId = data.schoolId || "";
    this.positionName = data.positionName || "";
    this.emailAddress = data.emailAddress || "";
    this.phoneNumber = data.phoneNumber || "";
    this.qualificationJson = data.qualificationJson || "[]";
    this.expertiseCategoryIdsJson = data.expertiseCategoryIdsJson || "[]";
    this.availabilityJson = data.availabilityJson || "[]";
    this.judgeStatus = data.judgeStatus || "ACTIVE"; // ACTIVE, SUSPENDED, ARCHIVED
    
    // Metadata
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class JudgeAssignmentEntity {
  constructor(data) {
    this.judgeAssignmentId = data.judgeAssignmentId || "";
    this.tenantId = data.tenantId || "";
    this.judgeId = data.judgeId || "";
    this.competitionId = data.competitionId || "";
    this.competitionRoundId = data.competitionRoundId || "";
    this.competitionCategoryConfigId = data.competitionCategoryConfigId || "";
    this.competitionRoomId = data.competitionRoomId || "";
    this.roomScheduleId = data.roomScheduleId || "";
    this.judgeRole = data.judgeRole || "SCORE_JUDGE"; // CHIEF_JUDGE, SCORE_JUDGE
    this.assignmentStatus = data.assignmentStatus || "ACTIVE"; // ACTIVE, SUSPENDED, REVOKED
    this.assignmentStartTimestamp = data.assignmentStartTimestamp || "";
    this.assignmentEndTimestamp = data.assignmentEndTimestamp || "";
    this.assignedBy = data.assignedBy || "";
    this.revokedTimestamp = data.revokedTimestamp || "";
    this.revokedBy = data.revokedBy || "";
    this.revocationReason = data.revocationReason || "";
    this.replacementJudgeAssignmentId = data.replacementJudgeAssignmentId || "";
    this.assignmentNotes = data.assignmentNotes || "";
    
    // Metadata
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class CompetitionRoomEntity {
  constructor(data) {
    this.competitionRoomId = data.competitionRoomId || "";
    this.tenantId = data.tenantId || "";
    this.competitionId = data.competitionId || "";
    this.venueId = data.venueId || "";
    this.roomCode = data.roomCode || "";
    this.roomNameTh = data.roomNameTh || "";
    this.roomNameEn = data.roomNameEn || "";
    this.roomType = data.roomType || "PHYSICAL";
    this.capacity = parseInt(data.capacity) || 0;
    this.floor = data.floor || "";
    this.buildingName = data.buildingName || "";
    this.accessibilitySupported = data.accessibilitySupported === true || data.accessibilitySupported === "TRUE" || data.accessibilitySupported === "true";
    this.facilitySettingsJson = data.facilitySettingsJson || "{}";
    this.operationalNotes = data.operationalNotes || "";
    this.roomStatus = data.roomStatus || "ACTIVE"; // ACTIVE, INACTIVE, ARCHIVED
    
    // Metadata
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class RoomScheduleEntity {
  constructor(data) {
    this.roomScheduleId = data.roomScheduleId || "";
    this.tenantId = data.tenantId || "";
    this.competitionId = data.competitionId || "";
    this.competitionRoundId = data.competitionRoundId || "";
    this.competitionCategoryConfigId = data.competitionCategoryConfigId || "";
    this.competitionRoomId = data.competitionRoomId || "";
    this.registrationId = data.registrationId || "";
    this.scheduleDate = data.scheduleDate || "";
    this.startTimestamp = data.startTimestamp || "";
    this.endTimestamp = data.endTimestamp || "";
    this.sequenceNumber = parseInt(data.sequenceNumber) || 1;
    this.scheduleStatus = data.scheduleStatus || "CONFIRMED"; // CONFIRMED, CANCELLED
    this.published = data.published === true || data.published === "TRUE" || data.published === "true";
    this.publishedTimestamp = data.publishedTimestamp || "";
    this.notes = data.notes || "";
    
    // Metadata
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class CheckInLogEntity {
  constructor(data) {
    this.checkinLogId = data.checkinLogId || "";
    this.tenantId = data.tenantId || "";
    this.competitionId = data.competitionId || "";
    this.registrationId = data.registrationId || "";
    this.registrationMemberId = data.registrationMemberId || "";
    this.coachId = data.coachId || "";
    this.judgeId = data.judgeId || "";
    this.roomScheduleId = data.roomScheduleId || "";
    this.subjectType = data.subjectType || "TEAM"; // TEAM, MEMBER, COACH, JUDGE
    this.subjectId = data.subjectId || "";
    this.checkinStatus = data.checkinStatus || "CHECKED_IN"; // NOT_CHECKED_IN, CHECKED_IN, LATE, ABSENT, REVERSED
    this.checkinMethod = data.checkinMethod || "MANUAL"; // MANUAL, QR_SCAN, ADMIN_OVERRIDE
    this.checkinTimestamp = data.checkinTimestamp || "";
    this.recordedBy = data.recordedBy || "";
    this.deviceId = data.deviceId || "";
    this.locationReference = data.locationReference || "";
    this.reversalOfCheckinLogId = data.reversalOfCheckinLogId || "";
    this.reversalReason = data.reversalReason || "";
    this.notes = data.notes || "";
    this.requestId = data.requestId || "";
    this.correlationId = data.correlationId || "";
    
    // Metadata
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class AnnouncementEntity {
  constructor(data) {
    this.announcementId = data.announcementId || "";
    this.tenantId = data.tenantId || "";
    this.competitionId = data.competitionId || "";
    this.venueId = data.venueId || "";
    this.competitionCategoryConfigId = data.competitionCategoryConfigId || "";
    this.competitionRoomId = data.competitionRoomId || "";
    this.titleTh = data.titleTh || "";
    this.titleEn = data.titleEn || "";
    this.bodyTh = data.bodyTh || "";
    this.bodyEn = data.bodyEn || "";
    this.audienceType = data.audienceType || "ALL_AUTHENTICATED";
    this.audienceFilterJson = data.audienceFilterJson || "{}";
    this.publishTimestamp = data.publishTimestamp || "";
    this.expireTimestamp = data.expireTimestamp || "";
    this.announcementStatus = data.announcementStatus || "DRAFT"; // DRAFT, PUBLISHED, EXPIRED, ARCHIVED
    this.priority = parseInt(data.priority) || 1;
    
    // Metadata
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}
