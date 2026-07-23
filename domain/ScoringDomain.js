/**
 * Competition Platform Engineering Standards (CPES)
 * Stage 7 - Scoring & Evaluation Domain Entities & Value Objects
 */

class ScorecardEntity {
  constructor(data) {
    this.scorecardId = data.scorecardId || "";
    this.tenantId = data.tenantId || "";
    this.competitionId = data.competitionId || "";
    this.competitionRoundId = data.competitionRoundId || "";
    this.competitionCategoryConfigId = data.competitionCategoryConfigId || "";
    this.registrationId = data.registrationId || "";
    this.roomScheduleId = data.roomScheduleId || "";
    this.judgeAssignmentId = data.judgeAssignmentId || "";
    this.judgeId = data.judgeId || "";
    this.scoreTemplateId = data.scoreTemplateId || "";
    this.scoreTemplateVersion = data.scoreTemplateVersion || "";
    this.scorecardStatus = data.scorecardStatus || "DRAFT"; // DRAFT, IN_PROGRESS, SUBMITTED, VERIFIED, HARD_LOCKED
    this.startedTimestamp = data.startedTimestamp || "";
    this.submittedTimestamp = data.submittedTimestamp || "";
    this.verifiedTimestamp = data.verifiedTimestamp || "";
    this.hardLockedTimestamp = data.hardLockedTimestamp || "";
    this.hardLockedBy = data.hardLockedBy || "";
    this.returnedTimestamp = data.returnedTimestamp || "";
    this.returnedBy = data.returnedBy || "";
    this.returnReason = data.returnReason || "";
    this.calculationVersion = data.calculationVersion || "v1";
    this.offlineSource = data.offlineSource === true || data.offlineSource === "TRUE" || data.offlineSource === "true";
    this.sourceDeviceId = data.sourceDeviceId || "";
    this.synchronizationStatus = data.synchronizationStatus || "SYNCED";
    
    // Metadata
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class ScoreDetailEntity {
  constructor(data) {
    this.scoreDetailId = data.scoreDetailId || "";
    this.tenantId = data.tenantId || "";
    this.scorecardId = data.scorecardId || "";
    this.scoreCriterionId = data.scoreCriterionId || "";
    this.criterionCode = data.criterionCode || "";
    this.rawScore = parseFloat(data.rawScore) || 0.0;
    this.normalizedScore = parseFloat(data.normalizedScore) || 0.0;
    this.weightedScore = parseFloat(data.weightedScore) || 0.0;
    this.rubricLevel = data.rubricLevel || "";
    this.passFailValue = data.passFailValue || "";
    this.comment = data.comment || "";
    this.enteredTimestamp = data.enteredTimestamp || "";
    this.enteredBy = data.enteredBy || "";
    this.sourceDeviceId = data.sourceDeviceId || "";
    this.offlineOperationId = data.offlineOperationId || "";
    
    // Metadata
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class ScoreSummaryEntity {
  constructor(data) {
    this.scoreSummaryId = data.scoreSummaryId || "";
    this.tenantId = data.tenantId || "";
    this.competitionId = data.competitionId || "";
    this.competitionRoundId = data.competitionRoundId || "";
    this.competitionCategoryConfigId = data.competitionCategoryConfigId || "";
    this.registrationId = data.registrationId || "";
    this.averageScore = parseFloat(data.averageScore) || 0.0;
    this.scoreVariance = parseFloat(data.scoreVariance) || 0.0;
    this.medalTier = data.medalTier || "";
    this.summaryStatus = data.summaryStatus || "PENDING"; // PENDING, VERIFIED, HARD_LOCKED
    
    // Metadata
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class ScoreLockHistoryEntryEntity {
  constructor(data) {
    this.scoreLockHistoryId = data.scoreLockHistoryId || "";
    this.tenantId = data.tenantId || "";
    this.competitionId = data.competitionId || "";
    this.competitionRoundId = data.competitionRoundId || "";
    this.competitionCategoryConfigId = data.competitionCategoryConfigId || "";
    this.registrationId = data.registrationId || "";
    this.scoreSummaryId = data.scoreSummaryId || "";
    this.action = data.action || ""; // VERIFIED, HARD_LOCKED, UNLOCKED, RETURNED_FOR_CORRECTION
    this.previousState = data.previousState || "";
    this.newState = data.newState || "";
    this.previousResultVersion = data.previousResultVersion || "";
    this.newResultVersion = data.newResultVersion || "";
    this.actorUserId = data.actorUserId || "";
    this.actorRoleCodesJson = data.actorRoleCodesJson || "[]";
    this.reason = data.reason || "";
    this.dependencyImpactJson = data.dependencyImpactJson || "[]";
    this.checksum = data.checksum || "";
    this.timestamp = data.timestamp || "";
    this.requestId = data.requestId || "";
    this.correlationId = data.correlationId || "";
  }
}

class AppealEntity {
  constructor(data) {
    this.appealId = data.appealId || "";
    this.tenantId = data.tenantId || "";
    this.competitionId = data.competitionId || "";
    this.registrationId = data.registrationId || "";
    this.reason = data.reason || "";
    this.evidenceUrl = data.evidenceUrl || "";
    this.appealStatus = data.appealStatus || "DRAFT"; // DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, RESOLVED, REJECTED
    this.reviewerId = data.reviewerId || "";
    this.resolutionNotes = data.resolutionNotes || "";
    
    // Metadata
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class RankingEntity {
  constructor(data) {
    this.rankingId = data.rankingId || "";
    this.tenantId = data.tenantId || "";
    this.competitionId = data.competitionId || "";
    this.competitionRoundId = data.competitionRoundId || "";
    this.competitionCategoryConfigId = data.competitionCategoryConfigId || "";
    this.registrationId = data.registrationId || "";
    this.rankPosition = parseInt(data.rankPosition) || 1;
    this.resultVersion = data.resultVersion || "v1";
    
    // Metadata
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class MedalEntity {
  constructor(data) {
    this.medalId = data.medalId || "";
    this.tenantId = data.tenantId || "";
    this.registrationId = data.registrationId || "";
    this.medalTier = data.medalTier || "";
    this.awardedTimestamp = data.awardedTimestamp || "";
    this.resultVersion = data.resultVersion || "v1";
    
    // Metadata
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class AwardEntity {
  constructor(data) {
    this.awardId = data.awardId || "";
    this.tenantId = data.tenantId || "";
    this.registrationId = data.registrationId || "";
    this.awardType = data.awardType || "";
    this.awardedTimestamp = data.awardedTimestamp || "";
    this.resultVersion = data.resultVersion || "v1";
    
    // Metadata
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class TrophyEntity {
  constructor(data) {
    this.trophyId = data.trophyId || "";
    this.tenantId = data.tenantId || "";
    this.schoolId = data.schoolId || "";
    this.trophyType = data.trophyType || ""; // OVERALL_GOLD, OVERALL_POINTS
    this.goldCount = parseInt(data.goldCount) || 0;
    this.silverCount = parseInt(data.silverCount) || 0;
    this.bronzeCount = parseInt(data.bronzeCount) || 0;
    this.calculatedTimestamp = data.calculatedTimestamp || "";
    this.resultVersion = data.resultVersion || "v1";
    
    // Metadata
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}
