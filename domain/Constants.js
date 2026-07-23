/**
 * Competition Platform Engineering Standards (CPES)
 * Domain Constants & System Enums
 */

const CMPE_CONSTANTS = {
  // Roles
  Roles: {
    SUPER_ADMIN: "SUPER_ADMIN",
    TENANT_ADMIN: "TENANT_ADMIN",
    AREA_ADMIN: "AREA_ADMIN",
    COMPETITION_MANAGER: "COMPETITION_MANAGER",
    REGISTRATION_OFFICER: "REGISTRATION_OFFICER",
    SCHOOL_ADMIN: "SCHOOL_ADMIN",
    SCHOOL_REGISTRAR: "SCHOOL_REGISTRAR",
    TEACHER: "TEACHER",
    JUDGE: "JUDGE",
    CHIEF_JUDGE: "CHIEF_JUDGE",
    SCORE_JUDGE: "SCORE_JUDGE",
    VENUE_MANAGER: "VENUE_MANAGER",
    CERTIFICATE_OFFICER: "CERTIFICATE_OFFICER",
    AUDITOR: "AUDITOR",
    GUEST_VIEWER: "GUEST_VIEWER",
    VIEWER: "VIEWER"
  },

  // Permissions
  Permissions: {
    COMP_CONFIGURE: "competition.configure",
    REG_CREATE: "registration.create",
    REG_APPROVE: "registration.approve",
    SCORE_ENTER: "score.enter",
    SCORE_VERIFY: "score.verify",
    SCORE_LOCK: "score.lock",
    SCORE_UNLOCK: "score.unlock",
    CERT_GENERATE: "certificate.generate",
    AUDIT_READ: "audit.read",
    SETTINGS_UPDATE: "system.settings.update"
  },

  // Canonical permission catalog used by both the API and the SPA. Tenant and
  // super administrators receive this catalog as an explicit wildcard while
  // granular roles continue to use role_permissions from the database.
  AllPermissions: [
    "tenant.read", "tenant.create",
    "academicYear.read", "academicYear.setCurrent",
    "province.read", "district.read",
    "school.read", "school.create", "school.import",
    "educationLevel.read", "competitionType.read",
    "competitionCategory.read", "competitionCategory.manage",
    "venue.read", "venue.manage",
    "competition.read", "competition.create", "competition.update",
    "competition.clone", "competition.transition",
    "competitionRound.manage", "competitionCategoryConfig.manage",
    "categoryRule.manage", "scoreTemplate.manage",
    "quotaRule.manage", "registrationWindow.manage", "medalRule.manage",
    "registration.readOwnSchool", "registration.readTenant",
    "registration.create", "registration.submit", "registration.review",
    "registration.approve", "registration.reject",
    "registrationMember.manage", "registrationCoach.manage",
    "judge.read", "judge.create", "judgeAssignment.create",
    "competitionRoom.manage", "roomSchedule.create",
    "operationalReadiness.validate", "checkin.record", "checkin.reverse",
    "announcement.create",
    "score.enter", "score.updateOwnDraft", "score.submit",
    "score.verify", "score.returnForCorrection", "score.lock", "score.unlock",
    "appeal.submit",
    "certificate.generate", "certificate.download",
    "certificate.revoke", "certificate.regenerate",
    "notification.readTenant", "notification.createManual",
    "dashboard.readTenant", "dashboard.readOwnSchool",
    "leaderboard.readInternal",
    "report.request", "report.readTenant", "report.readOwn",
    "audit.read", "system.settings.update"
  ],

  // Metadata Columns required for mutable tenant tables
  MetadataColumns: [
    "tenantId",
    "createdTimestamp",
    "createdBy",
    "lastModifiedTimestamp",
    "lastModifiedBy",
    "rowVersion",
    "recordStatus",
    "deletedTimestamp",
    "deletedBy"
  ],

  // Full Worksheets Catalog (75 worksheets)
  TableCatalog: {
    // System & Provisioning
    metadata: { pk: "metadataId", mutable: false, cols: ["key", "value", "description"] },
    migrations: { pk: "migrationId", mutable: false, cols: ["versionFrom", "versionTo", "checksum", "appliedTimestamp", "executionLog"] },
    settings: { pk: "settingId", mutable: true, cols: ["key", "value", "description", "type"] },
    feature_flags: { pk: "featureFlagId", mutable: true, cols: ["flagKey", "enabled", "description"] },
    running_numbers: { pk: "runningNumberId", mutable: true, cols: ["typeCode", "currentValue", "formatPattern"] },
    background_jobs: { pk: "jobId", mutable: true, cols: ["state", "taskName", "attemptCount", "maxAttempts", "nextRunTimestamp", "leaseOwner", "leaseExpiry", "payloadJson", "resultJson", "correlationId"] },
    scheduler: { pk: "scheduleId", mutable: true, cols: ["taskName", "cronExpression", "active", "lastRunTimestamp"] },
    sync_batches: { pk: "syncBatchId", mutable: true, cols: ["batchStatus", "deviceId", "clientTimestamp"] },
    sync_operations: { pk: "syncOperationId", mutable: true, cols: ["syncBatchId", "operationType", "entityType", "entityId", "expectedRowVersion", "payloadJson", "receiptJson"] },

    // Identity & Access
    tenants: { pk: "tenantId", mutable: true, cols: ["name", "province", "adminUsername", "adminPasswordHash", "status"] },
    users: { pk: "userId", mutable: true, cols: ["username", "passwordHash", "salt", "iterations", "status", "failedLoginCount", "lockoutUntil", "passwordExpiredTimestamp"] },
    user_profiles: { pk: "userProfileId", mutable: true, cols: ["userId", "firstName", "lastName", "email", "phone"] },
    roles: { pk: "roleId", mutable: true, cols: ["roleCode", "name"] },
    permissions: { pk: "permissionId", mutable: true, cols: ["permissionCode", "name"] },
    role_permissions: { pk: "rolePermissionId", mutable: true, cols: ["roleId", "permissionId"] },
    user_roles: { pk: "userRoleId", mutable: true, cols: ["userId", "roleId", "scope"] },
    user_sessions: { pk: "sessionId", mutable: true, cols: ["userId", "sessionTokenHash", "expiryTimestamp"] },
    password_history: { pk: "passwordHistoryId", mutable: false, cols: ["userId", "passwordHash", "changedTimestamp"] },
    login_history: { pk: "loginHistoryId", mutable: false, cols: ["username", "loginStatus", "timestamp", "ipAddress"] },
    api_tokens: { pk: "apiTokenId", mutable: true, cols: ["name", "tokenHash", "userId", "expiryTimestamp"] },

    // Master Data
    academic_years: { pk: "academicYearId", mutable: true, cols: ["yearValue", "status", "isCurrent"] },
    provinces: { pk: "provinceId", mutable: true, cols: ["provinceCode", "nameTh", "nameEn"] },
    districts: { pk: "districtId", mutable: true, cols: ["provinceId", "districtCode", "nameTh", "nameEn"] },
    schools: { pk: "schoolId", mutable: true, cols: ["nameTh", "nameEn", "districtId"] },
    education_levels: { pk: "educationLevelId", mutable: true, cols: ["levelCode", "nameTh", "nameEn"] },
    competition_types: { pk: "competitionTypeId", mutable: true, cols: ["typeCode", "nameTh", "nameEn"] },
    competition_categories: { pk: "categoryId", mutable: true, cols: ["categoryCode", "nameTh", "nameEn"] },
    venues: { pk: "venueId", mutable: true, cols: ["name", "address"] },

    // Competition Configuration
    competitions: { pk: "competitionId", mutable: true, cols: ["academicYearId", "competitionCode", "nameTh", "nameEn", "competitionTypeId", "startDate", "endDate", "timezone", "status"] },
    competition_rounds: { pk: "competitionRoundId", mutable: true, cols: ["competitionId", "roundSequence", "nameTh", "nameEn", "status"] },
    competition_category_configs: { pk: "competitionCategoryConfigId", mutable: true, cols: ["competitionId", "categoryId", "educationLevelId", "scoreTemplateId", "medalRuleId", "certificateTemplateId", "quotaRuleId", "registrationWindowId", "status", "displayOrder", "participantMinOverride", "participantMaxOverride", "coachMinOverride", "coachMaxOverride"] },
    category_rules: { pk: "categoryRuleId", mutable: true, cols: ["competitionCategoryConfigId", "ruleCode", "ruleType", "ruleVersion", "priority", "conditionJson", "actionJson", "errorCode", "errorMessageTh", "errorMessageEn", "status"] },
    score_templates: { pk: "scoreTemplateId", mutable: true, cols: ["name", "aggregationMethod", "decimalPrecision", "status"] },
    score_criteria: { pk: "scoreCriterionId", mutable: true, cols: ["scoreTemplateId", "criterionCode", "nameTh", "nameEn", "criterionType", "minimumScore", "maximumScore", "weight", "displayOrder", "status"] },
    quota_rules: { pk: "quotaRuleId", mutable: true, cols: ["name", "scopeType", "maxRegistrations", "status"] },
    schedule_templates: { pk: "scheduleTemplateId", mutable: true, cols: ["name", "slotDurationMinutes", "breakDurationMinutes", "status"] },
    certificate_templates: { pk: "certificateTemplateId", mutable: true, cols: ["name", "slidesFileId", "placeholderMapJson", "status"] },
    medal_rules: { pk: "medalRuleId", mutable: true, cols: ["name", "goldThreshold", "silverThreshold", "bronzeThreshold", "status"] },
    registration_windows: { pk: "registrationWindowId", mutable: true, cols: ["competitionId", "openTimestamp", "closeTimestamp", "status"] },

    // Registration
    registrations: { pk: "registrationId", mutable: true, cols: ["schoolId", "competitionId", "competitionCategoryConfigId", "registrationCode", "registrationNumber", "registrationStatus", "teamName", "submissionTimestamp", "submittedBy", "approvalTimestamp", "approvedBy", "rejectionTimestamp", "rejectedBy", "rejectionReason", "withdrawalTimestamp", "withdrawnBy", "withdrawalReason", "overrideReason", "configurationVersion", "ruleEvaluationVersion"] },
    registration_members: { pk: "registrationMemberId", mutable: true, cols: ["registrationId", "participantNumber", "title", "firstNameTh", "lastNameTh", "firstNameEn", "lastNameEn", "gender", "dateOfBirth", "educationLevelId", "gradeLevel", "schoolId", "memberRole", "identityFingerprint", "displayOrder"] },
    coaches: { pk: "coachId", mutable: true, cols: ["registrationId", "userId", "title", "firstNameTh", "lastNameTh", "positionName", "schoolId", "emailAddress", "phoneNumber", "isLeadCoach", "displayOrder"] },
    substitutes: { pk: "substituteId", mutable: true, cols: ["registrationId", "title", "firstNameTh", "lastNameTh", "gender", "dateOfBirth", "educationLevelId", "gradeLevel", "schoolId", "displayOrder"] },
    attachments: { pk: "attachmentId", mutable: true, cols: ["registrationId", "fileName", "fileType", "driveFileId"] },
    registration_history: { pk: "registrationHistoryId", mutable: false, cols: ["registrationId", "actionType", "changeLogJson"] },

    // Competition Operations
    judges: { pk: "judgeId", mutable: true, cols: ["judgeCode", "userId", "title", "firstNameTh", "lastNameTh", "firstNameEn", "lastNameEn", "displayName", "schoolId", "positionName", "emailAddress", "phoneNumber", "qualificationJson", "expertiseCategoryIdsJson", "availabilityJson", "judgeStatus"] },
    judge_assignments: { pk: "judgeAssignmentId", mutable: true, cols: ["judgeId", "competitionId", "competitionRoundId", "competitionCategoryConfigId", "competitionRoomId", "roomScheduleId", "judgeRole", "assignmentStatus", "assignmentStartTimestamp", "assignmentEndTimestamp", "assignedBy", "revokedTimestamp", "revokedBy", "revocationReason", "replacementJudgeAssignmentId", "assignmentNotes"] },
    checkin_logs: { pk: "checkinLogId", mutable: false, cols: ["competitionId", "registrationId", "registrationMemberId", "coachId", "judgeId", "roomScheduleId", "subjectType", "subjectId", "checkinStatus", "checkinMethod", "checkinTimestamp", "recordedBy", "deviceId", "locationReference", "reversalOfCheckinLogId", "reversalReason", "notes", "requestId", "correlationId"] },
    competition_rooms: { pk: "competitionRoomId", mutable: true, cols: ["competitionId", "venueId", "roomCode", "roomNameTh", "roomNameEn", "roomType", "capacity", "floor", "buildingName", "accessibilitySupported", "facilitySettingsJson", "operationalNotes", "roomStatus"] },
    room_schedules: { pk: "roomScheduleId", mutable: true, cols: ["competitionId", "competitionRoundId", "competitionCategoryConfigId", "competitionRoomId", "registrationId", "scheduleDate", "startTimestamp", "endTimestamp", "sequenceNumber", "scheduleStatus", "published", "publishedTimestamp", "notes"] },
    announcements: { pk: "announcementId", mutable: true, cols: ["competitionId", "venueId", "competitionCategoryConfigId", "competitionRoomId", "titleTh", "titleEn", "bodyTh", "bodyEn", "audienceType", "audienceFilterJson", "publishTimestamp", "expireTimestamp", "announcementStatus", "priority"] },

    // Scoring & Results
    scorecards: { pk: "scorecardId", mutable: true, cols: ["competitionId", "competitionRoundId", "competitionCategoryConfigId", "registrationId", "roomScheduleId", "judgeAssignmentId", "judgeId", "scoreTemplateId", "scoreTemplateVersion", "scorecardStatus", "startedTimestamp", "submittedTimestamp", "verifiedTimestamp", "hardLockedTimestamp", "hardLockedBy", "returnedTimestamp", "returnedBy", "returnReason", "calculationVersion", "offlineSource", "sourceDeviceId", "synchronizationStatus"] },
    score_details: { pk: "scoreDetailId", mutable: true, cols: ["scorecardId", "scoreCriterionId", "criterionCode", "rawScore", "normalizedScore", "weightedScore", "rubricLevel", "passFailValue", "comment", "enteredTimestamp", "enteredBy", "sourceDeviceId", "offlineOperationId"] },
    score_summary: { pk: "scoreSummaryId", mutable: true, cols: ["competitionId", "competitionRoundId", "competitionCategoryConfigId", "registrationId", "averageScore", "scoreVariance", "medalTier", "summaryStatus"] },
    score_lock_history: { pk: "scoreLockHistoryId", mutable: false, cols: ["competitionId", "competitionRoundId", "competitionCategoryConfigId", "registrationId", "scoreSummaryId", "action", "previousState", "newState", "previousResultVersion", "newResultVersion", "actorUserId", "actorRoleCodesJson", "reason", "dependencyImpactJson", "checksum", "timestamp", "requestId", "correlationId"] },
    appeals: { pk: "appealId", mutable: true, cols: ["competitionId", "registrationId", "reason", "evidenceUrl", "appealStatus", "reviewerId", "resolutionNotes"] },
    rankings: { pk: "rankingId", mutable: true, cols: ["competitionId", "competitionRoundId", "competitionCategoryConfigId", "registrationId", "rankPosition", "resultVersion"] },
    medals: { pk: "medalId", mutable: true, cols: ["registrationId", "medalTier", "awardedTimestamp", "resultVersion"] },
    awards: { pk: "awardId", mutable: true, cols: ["registrationId", "awardType", "awardedTimestamp", "resultVersion"] },
    trophies: { pk: "trophyId", mutable: true, cols: ["schoolId", "trophyType", "goldCount", "silverCount", "bronzeCount", "calculatedTimestamp", "resultVersion"] },

    // Certificates
    certificates: { pk: "certificateId", mutable: true, cols: ["certificateNumber", "certificateVersion", "supersedesCertificateId", "recipientType", "recipientReferenceId", "recipientNameSnapshot", "recipientTitleSnapshot", "schoolId", "schoolNameSnapshot", "competitionId", "competitionNameSnapshot", "competitionCategoryConfigId", "categoryNameSnapshot", "competitionRoundId", "roundNameSnapshot", "academicYearId", "academicYearSnapshot", "registrationId", "registrationNumberSnapshot", "scoreSummaryId", "finalScoreSnapshot", "medalTierSnapshot", "awardNameSnapshot", "rankingSnapshot", "certificateTemplateId", "templateVersionSnapshot", "issueDateSnapshot", "issuerNameSnapshot", "resultVersion", "verificationToken", "verificationHash", "integrityChecksum", "qrPayload", "pdfFileId", "pdfFileName", "pdfMimeType", "generationStatus", "certificateStatus", "generatedTimestamp", "activatedTimestamp", "revokedTimestamp", "revokedBy", "revocationReason"] },
    certificate_verification: { pk: "certificateVerificationId", mutable: true, cols: ["certificateId", "verificationToken", "verificationHash", "integrityChecksum", "verificationStatus", "publicDisplayJson", "issuedTimestamp", "activatedTimestamp", "revokedTimestamp", "supersededTimestamp", "lastVerifiedTimestamp", "verificationCount", "resultVersion", "certificateVersion"] },
    certificate_downloads: { pk: "certificateDownloadId", mutable: false, cols: ["certificateId", "downloadTimestamp", "downloadedBy", "accessType", "requestId", "deviceId", "ipAddressHash", "userAgent", "downloadResult"] },

    // Notifications
    notifications: { pk: "notificationId", mutable: true, cols: ["notificationCode", "notificationType", "sourceContext", "sourceEntityType", "sourceEntityId", "sourceVersion", "correlationId", "idempotencyKey", "priority", "locale", "subjectTemplateCode", "bodyTemplateCode", "payloadJson", "recipientResolutionStatus", "notificationStatus", "scheduledTimestamp", "expiresTimestamp"] },
    telegram_queue: { pk: "telegramQueueId", mutable: true, cols: ["notificationId", "chatIdReference", "recipientUserId", "renderedMessage", "parseMode", "scheduledTimestamp", "deliveryStatus", "attemptCount", "maxAttempts", "nextAttemptTimestamp", "lastAttemptTimestamp", "deliveredTimestamp", "providerMessageId", "providerResponseCode", "failureCategory", "lastErrorCode", "lastErrorMessage", "idempotencyKey", "correlationId"] },
    email_queue: { pk: "emailQueueId", mutable: true, cols: ["notificationId", "recipientEmail", "recipientName", "ccJson", "bccJson", "subject", "textBody", "htmlBody", "attachmentFileIdsJson", "scheduledTimestamp", "deliveryStatus", "attemptCount", "maxAttempts", "nextAttemptTimestamp", "lastAttemptTimestamp", "deliveredTimestamp", "providerMessageId", "failureCategory", "lastErrorCode", "lastErrorMessage", "idempotencyKey", "correlationId"] },
    sms_queue: { pk: "smsQueueId", mutable: true, cols: ["notificationId", "recipientPhone", "renderedMessage", "providerCode", "scheduledTimestamp", "deliveryStatus", "attemptCount", "maxAttempts", "nextAttemptTimestamp", "deliveredTimestamp", "providerMessageId", "providerResponseCode", "failureCategory", "lastErrorCode", "lastErrorMessage", "idempotencyKey", "correlationId"] },

    // Analytics
    dashboard_cache: { pk: "dashboardCacheId", mutable: true, cols: ["academicYearId", "competitionId", "dashboardCode", "audienceScope", "filterKey", "metricPayloadJson", "sourceVersion", "cacheVersion", "generatedTimestamp", "expiresTimestamp", "freshnessStatus", "generationStatus", "generatedByJobId", "checksum"] },
    leaderboard_cache: { pk: "leaderboardCacheId", mutable: true, cols: ["academicYearId", "competitionId", "competitionCategoryConfigId", "competitionRoundId", "leaderboardType", "resultVersion", "rankingPolicyVersion", "payloadJson", "generatedTimestamp", "publishedTimestamp", "freshnessStatus", "checksum"] },
    statistics: { pk: "statisticId", mutable: true, cols: ["academicYearId", "competitionId", "categoryId", "metricCode", "dimensionCode", "dimensionValue", "periodType", "periodStart", "periodEnd", "numericValue", "textValue", "payloadJson", "sourceVersion", "generatedTimestamp", "checksum"] },
    reports: { pk: "reportId", mutable: true, cols: ["reportCode", "reportName", "requestedBy", "requestTimestamp", "filterJson", "sortJson", "format", "reportStatus", "sourceVersion", "generatedTimestamp", "expiresTimestamp", "outputFileId", "outputFileName", "outputMimeType", "rowCount", "pageCount", "checksum", "failureCode", "failureMessage", "generatedByJobId"] },

    // Audit & Observability
    audit_logs: { pk: "auditLogId", mutable: false, cols: ["timestamp", "actorUserId", "actorRoleCodesJson", "action", "entityType", "entityId", "previousValueJson", "newValueJson", "reason", "requestId", "correlationId", "deviceId", "ipAddressHash", "result"] },
    api_logs: { pk: "apiLogId", mutable: false, cols: ["timestamp", "endpoint", "latencyMs", "status"] },
    security_logs: { pk: "securityLogId", mutable: false, cols: ["timestamp", "userId", "eventType", "details"] },
    error_logs: { pk: "errorLogId", mutable: false, cols: ["timestamp", "errorCode", "message", "stackTrace"] }
  }
};
