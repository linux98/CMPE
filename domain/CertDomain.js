/**
 * Competition Platform Engineering Standards (CPES)
 * Stage 8 - Certificate & Verification Domain Entities & Value Objects
 */

class CertificateEntity {
  constructor(data) {
    this.certificateId = data.certificateId || "";
    this.tenantId = data.tenantId || "";
    this.certificateNumber = data.certificateNumber || "";
    this.certificateVersion = parseInt(data.certificateVersion) || 1;
    this.supersedesCertificateId = data.supersedesCertificateId || "";
    this.recipientType = data.recipientType || "PARTICIPANT"; // PARTICIPANT, COACH, CHIEF_JUDGE, SCORE_JUDGE, SCHOOL
    this.recipientReferenceId = data.recipientReferenceId || "";
    this.recipientNameSnapshot = data.recipientNameSnapshot || "";
    this.recipientTitleSnapshot = data.recipientTitleSnapshot || "";
    this.schoolId = data.schoolId || "";
    this.schoolNameSnapshot = data.schoolNameSnapshot || "";
    this.competitionId = data.competitionId || "";
    this.competitionNameSnapshot = data.competitionNameSnapshot || "";
    this.competitionCategoryConfigId = data.competitionCategoryConfigId || "";
    this.categoryNameSnapshot = data.categoryNameSnapshot || "";
    this.competitionRoundId = data.competitionRoundId || "";
    this.roundNameSnapshot = data.roundNameSnapshot || "";
    this.academicYearId = data.academicYearId || "";
    this.academicYearSnapshot = data.academicYearSnapshot || "";
    this.registrationId = data.registrationId || "";
    this.registrationNumberSnapshot = data.registrationNumberSnapshot || "";
    this.scoreSummaryId = data.scoreSummaryId || "";
    this.finalScoreSnapshot = parseFloat(data.finalScoreSnapshot) || 0.0;
    this.medalTierSnapshot = data.medalTierSnapshot || "";
    this.awardNameSnapshot = data.awardNameSnapshot || "";
    this.rankingSnapshot = data.rankingSnapshot || "";
    this.certificateTemplateId = data.certificateTemplateId || "";
    this.templateVersionSnapshot = data.templateVersionSnapshot || "";
    this.issueDateSnapshot = data.issueDateSnapshot || "";
    this.issuerNameSnapshot = data.issuerNameSnapshot || "";
    this.resultVersion = data.resultVersion || "v1";
    this.verificationToken = data.verificationToken || "";
    this.verificationHash = data.verificationHash || "";
    this.integrityChecksum = data.integrityChecksum || "";
    this.qrPayload = data.qrPayload || "";
    this.pdfFileId = data.pdfFileId || "";
    this.pdfFileName = data.pdfFileName || "";
    this.pdfMimeType = data.pdfMimeType || "application/pdf";
    this.generationStatus = data.generationStatus || "QUEUED"; // QUEUED, GENERATING, GENERATED, FAILED
    this.certificateStatus = data.certificateStatus || "ACTIVE"; // ACTIVE, REVOKED, SUPERSEDED
    
    // Timestamps
    this.generatedTimestamp = data.generatedTimestamp || "";
    this.activatedTimestamp = data.activatedTimestamp || "";
    this.revokedTimestamp = data.revokedTimestamp || "";
    this.revokedBy = data.revokedBy || "";
    this.revocationReason = data.revocationReason || "";

    // Metadata
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class CertificateVerificationEntity {
  constructor(data) {
    this.certificateVerificationId = data.certificateVerificationId || "";
    this.tenantId = data.tenantId || "";
    this.certificateId = data.certificateId || "";
    this.verificationToken = data.verificationToken || "";
    this.verificationHash = data.verificationHash || "";
    this.integrityChecksum = data.integrityChecksum || "";
    this.verificationStatus = data.verificationStatus || "VALID"; // VALID, REVOKED, SUPERSEDED
    this.publicDisplayJson = data.publicDisplayJson || "{}";
    this.issuedTimestamp = data.issuedTimestamp || "";
    this.activatedTimestamp = data.activatedTimestamp || "";
    this.revokedTimestamp = data.revokedTimestamp || "";
    this.supersededTimestamp = data.supersededTimestamp || "";
    this.lastVerifiedTimestamp = data.lastVerifiedTimestamp || "";
    this.verificationCount = parseInt(data.verificationCount) || 0;
    this.resultVersion = data.resultVersion || "v1";
    this.certificateVersion = parseInt(data.certificateVersion) || 1;
    
    // Metadata
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class CertificateDownloadEntity {
  constructor(data) {
    this.certificateDownloadId = data.certificateDownloadId || "";
    this.tenantId = data.tenantId || "";
    this.certificateId = data.certificateId || "";
    this.downloadTimestamp = data.downloadTimestamp || "";
    this.downloadedBy = data.downloadedBy || "";
    this.accessType = data.accessType || "PUBLIC_VERIFICATION"; // PUBLIC_VERIFICATION, SCHOOL_USER, ADMIN
    this.requestId = data.requestId || "";
    this.deviceId = data.deviceId || "";
    this.ipAddressHash = data.ipAddressHash || "";
    this.userAgent = data.userAgent || "";
    this.downloadResult = data.downloadResult || "SUCCESS";
    
    // Metadata
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}
