/**
 * Competition Platform Engineering Standards (CPES)
 * Stage 5 - Registration Domain Entities & Value Objects
 */

class RegistrationEntity {
  constructor(data) {
    this.registrationId = data.registrationId || "";
    this.tenantId = data.tenantId || "";
    this.registrationNumber = data.registrationNumber || "";
    this.competitionId = data.competitionId || "";
    this.competitionCategoryConfigId = data.competitionCategoryConfigId || "";
    this.schoolId = data.schoolId || "";
    this.registrationStatus = data.registrationStatus || "DRAFT"; // DRAFT, SUBMITTED, APPROVED, REJECTED, WITHDRAWN
    this.teamName = data.teamName || "";
    this.submissionTimestamp = data.submissionTimestamp || "";
    this.submittedBy = data.submittedBy || "";
    this.approvalTimestamp = data.approvalTimestamp || "";
    this.approvedBy = data.approvedBy || "";
    this.rejectionTimestamp = data.rejectionTimestamp || "";
    this.rejectedBy = data.rejectedBy || "";
    this.rejectionReason = data.rejectionReason || "";
    this.withdrawalTimestamp = data.withdrawalTimestamp || "";
    this.withdrawnBy = data.withdrawnBy || "";
    this.withdrawalReason = data.withdrawalReason || "";
    this.overrideReason = data.overrideReason || "";
    
    // Metadata
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }

  canTransitionTo(nextStatus) {
    const validTransitions = {
      "DRAFT": ["SUBMITTED"],
      "SUBMITTED": ["APPROVED", "REJECTED"],
      "APPROVED": ["WITHDRAWN"],
      "REJECTED": ["DRAFT"], // Allowed only when resubmission correction policy is active
      "WITHDRAWN": []
    };

    const allowed = validTransitions[this.registrationStatus] || [];
    return allowed.includes(nextStatus);
  }
}

class RegistrationMemberEntity {
  constructor(data) {
    this.registrationMemberId = data.registrationMemberId || "";
    this.tenantId = data.tenantId || "";
    this.registrationId = data.registrationId || "";
    this.participantNumber = data.participantNumber || "";
    this.title = data.title || "";
    this.firstNameTh = data.firstNameTh || "";
    this.lastNameTh = data.lastNameTh || "";
    this.firstNameEn = data.firstNameEn || "";
    this.lastNameEn = data.lastNameEn || "";
    this.gender = data.gender || "";
    this.dateOfBirth = data.dateOfBirth || "";
    this.educationLevelId = data.educationLevelId || "";
    this.gradeLevel = data.gradeLevel || "";
    this.schoolId = data.schoolId || "";
    this.memberRole = data.memberRole || "CONTESTANT";
    this.identityFingerprint = data.identityFingerprint || "";
    this.displayOrder = parseInt(data.displayOrder) || 1;
    
    // Metadata
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }

  /**
   * Generates a deterministic duplicate-key fingerprint for the member
   */
  getDuplicateFingerprint() {
    // Normalizes name and date of birth to check duplicates safely without national ID
    const first = (this.firstNameTh || "").trim().toLowerCase();
    const last = (this.lastNameTh || "").trim().toLowerCase();
    const dob = (this.dateOfBirth || "").trim();
    return `${first}_${last}_${dob}`;
  }
}

class CoachEntity {
  constructor(data) {
    this.coachId = data.coachId || "";
    this.tenantId = data.tenantId || "";
    this.registrationId = data.registrationId || "";
    this.userId = data.userId || "";
    this.title = data.title || "";
    this.firstNameTh = data.firstNameTh || "";
    this.lastNameTh = data.lastNameTh || "";
    this.positionName = data.positionName || "";
    this.schoolId = data.schoolId || "";
    this.emailAddress = data.emailAddress || "";
    this.phoneNumber = data.phoneNumber || "";
    this.isLeadCoach = data.isLeadCoach === true || data.isLeadCoach === "TRUE" || data.isLeadCoach === "true";
    this.displayOrder = parseInt(data.displayOrder) || 1;
    
    // Metadata
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class SubstituteEntity {
  constructor(data) {
    this.substituteId = data.substituteId || "";
    this.tenantId = data.tenantId || "";
    this.registrationId = data.registrationId || "";
    this.title = data.title || "";
    this.firstNameTh = data.firstNameTh || "";
    this.lastNameTh = data.lastNameTh || "";
    this.gender = data.gender || "";
    this.dateOfBirth = data.dateOfBirth || "";
    this.educationLevelId = data.educationLevelId || "";
    this.gradeLevel = data.gradeLevel || "";
    this.schoolId = data.schoolId || "";
    this.displayOrder = parseInt(data.displayOrder) || 1;
    
    // Metadata
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class RegistrationAttachmentEntity {
  constructor(data) {
    this.attachmentId = data.attachmentId || "";
    this.tenantId = data.tenantId || "";
    this.registrationId = data.registrationId || "";
    this.fileName = data.fileName || "";
    this.fileType = data.fileType || "";
    this.driveFileId = data.driveFileId || "";
    
    // Metadata
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class RegistrationHistoryEntryEntity {
  constructor(data) {
    this.registrationHistoryId = data.registrationHistoryId || "";
    this.tenantId = data.tenantId || "";
    this.registrationId = data.registrationId || "";
    this.actionType = data.actionType || "CREATED"; // CREATED, VALIDATED, SUBMITTED, APPROVED
    this.changeLogJson = data.changeLogJson || "{}";
    
    // Metadata
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}
