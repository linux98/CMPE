/**
 * Competition Platform Engineering Standards (CPES)
 * Stage 9 - Notification Queue Domain Entities & Value Objects
 */

class NotificationEntity {
  constructor(data) {
    this.notificationId = data.notificationId || "";
    this.tenantId = data.tenantId || "";
    this.notificationCode = data.notificationCode || "";
    this.notificationType = data.notificationType || "IN_APP";
    this.sourceContext = data.sourceContext || "";
    this.sourceEntityType = data.sourceEntityType || "";
    this.sourceEntityId = data.sourceEntityId || "";
    this.sourceVersion = parseInt(data.sourceVersion) || 1;
    this.correlationId = data.correlationId || "";
    this.idempotencyKey = data.idempotencyKey || "";
    this.priority = data.priority || "NORMAL"; // HIGH, NORMAL, LOW
    this.locale = data.locale || "th";
    this.subjectTemplateCode = data.subjectTemplateCode || "";
    this.bodyTemplateCode = data.bodyTemplateCode || "";
    this.payloadJson = data.payloadJson || "{}";
    this.recipientResolutionStatus = data.recipientResolutionStatus || "PENDING";
    this.notificationStatus = data.notificationStatus || "CREATED"; // CREATED, QUEUED, DELIVERED, FAILED, CANCELLED, STALE
    
    // Scheduled & Expirations
    this.scheduledTimestamp = data.scheduledTimestamp || "";
    this.expiresTimestamp = data.expiresTimestamp || "";

    // Metadata
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class TelegramQueueItemEntity {
  constructor(data) {
    this.telegramQueueId = data.telegramQueueId || "";
    this.tenantId = data.tenantId || "";
    this.notificationId = data.notificationId || "";
    this.chatIdReference = data.chatIdReference || "";
    this.recipientUserId = data.recipientUserId || "";
    this.renderedMessage = data.renderedMessage || "";
    this.parseMode = data.parseMode || "HTML";
    this.scheduledTimestamp = data.scheduledTimestamp || "";
    this.deliveryStatus = data.deliveryStatus || "QUEUED"; // QUEUED, PROCESSING, DELIVERED, FAILED, DEAD_LETTER, CANCELLED, STALE
    this.attemptCount = parseInt(data.attemptCount) || 0;
    this.maxAttempts = parseInt(data.maxAttempts) || 5;
    this.nextAttemptTimestamp = data.nextAttemptTimestamp || "";
    this.lastAttemptTimestamp = data.lastAttemptTimestamp || "";
    this.deliveredTimestamp = data.deliveredTimestamp || "";
    this.providerMessageId = data.providerMessageId || "";
    this.providerResponseCode = data.providerResponseCode || "";
    this.failureCategory = data.failureCategory || "";
    this.lastErrorCode = data.lastErrorCode || "";
    this.lastErrorMessage = data.lastErrorMessage || "";
    this.idempotencyKey = data.idempotencyKey || "";
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

class EmailQueueItemEntity {
  constructor(data) {
    this.emailQueueId = data.emailQueueId || "";
    this.tenantId = data.tenantId || "";
    this.notificationId = data.notificationId || "";
    this.recipientEmail = data.recipientEmail || "";
    this.recipientName = data.recipientName || "";
    this.ccJson = data.ccJson || "[]";
    this.bccJson = data.bccJson || "[]";
    this.subject = data.subject || "";
    this.textBody = data.textBody || "";
    this.htmlBody = data.htmlBody || "";
    this.attachmentFileIdsJson = data.attachmentFileIdsJson || "[]";
    this.scheduledTimestamp = data.scheduledTimestamp || "";
    this.deliveryStatus = data.deliveryStatus || "QUEUED"; // QUEUED, DELIVERED, FAILED, DEAD_LETTER, CANCELLED, STALE
    this.attemptCount = parseInt(data.attemptCount) || 0;
    this.maxAttempts = parseInt(data.maxAttempts) || 5;
    this.nextAttemptTimestamp = data.nextAttemptTimestamp || "";
    this.lastAttemptTimestamp = data.lastAttemptTimestamp || "";
    this.deliveredTimestamp = data.deliveredTimestamp || "";
    this.providerMessageId = data.providerMessageId || "";
    this.failureCategory = data.failureCategory || "";
    this.lastErrorCode = data.lastErrorCode || "";
    this.lastErrorMessage = data.lastErrorMessage || "";
    this.idempotencyKey = data.idempotencyKey || "";
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

class SmsQueueItemEntity {
  constructor(data) {
    this.smsQueueId = data.smsQueueId || "";
    this.tenantId = data.tenantId || "";
    this.notificationId = data.notificationId || "";
    this.recipientPhone = data.recipientPhone || "";
    this.renderedMessage = data.renderedMessage || "";
    this.providerCode = data.providerCode || "";
    this.scheduledTimestamp = data.scheduledTimestamp || "";
    this.deliveryStatus = data.deliveryStatus || "QUEUED"; // QUEUED, DELIVERED, FAILED, DEAD_LETTER, CANCELLED, STALE
    this.attemptCount = parseInt(data.attemptCount) || 0;
    this.maxAttempts = parseInt(data.maxAttempts) || 5;
    this.nextAttemptTimestamp = data.nextAttemptTimestamp || "";
    this.deliveredTimestamp = data.deliveredTimestamp || "";
    this.providerMessageId = data.providerMessageId || "";
    this.providerResponseCode = data.providerResponseCode || "";
    this.failureCategory = data.failureCategory || "";
    this.lastErrorCode = data.lastErrorCode || "";
    this.lastErrorMessage = data.lastErrorMessage || "";
    this.idempotencyKey = data.idempotencyKey || "";
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
