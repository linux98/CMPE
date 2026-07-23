/**
 * Competition Platform Engineering Standards (CPES)
 * Stage 9 - Notification Queue & Delivery Services
 */

class NotificationCreationService {
  constructor(notifyRepo) {
    this.notifyRepo = notifyRepo;
  }

  createNotification(payload, actor) {
    // Idempotency check
    if (payload.idempotencyKey) {
      const existing = this.notifyRepo.findByIdempotencyKey(payload.idempotencyKey, actor.tenantId);
      if (existing) {
        return existing;
      }
    }

    const n = new NotificationEntity(payload);
    n.notificationId = payload.notificationId || CMPE_UTILITIES.generateUuid();
    n.tenantId = actor.tenantId;
    n.notificationStatus = "CREATED";
    n.recipientResolutionStatus = "RESOLVED";
    n.createdTimestamp = new Date().toISOString();
    n.rowVersion = 1;

    return this.notifyRepo.create(n, actor);
  }
}

class ChannelRoutingService {
  constructor(telegramRepo, emailRepo, smsRepo) {
    this.telegramRepo = telegramRepo;
    this.emailRepo = emailRepo;
    this.smsRepo = smsRepo;
  }

  routeNotification(notification, channels, recipientAddress, actor) {
    const outputs = [];
    
    if (channels.indexOf("TELEGRAM") !== -1) {
      const tg = new TelegramQueueItemEntity({
        telegramQueueId: CMPE_UTILITIES.generateUuid(),
        tenantId: actor.tenantId,
        notificationId: notification.notificationId,
        chatIdReference: recipientAddress.telegramChatId || "@sample_chat_group",
        renderedMessage: `<b>[CMPE Alert]</b>: ${notification.notificationCode} - ดำเนินการขั้นตอนถัดไปในระบบแล้ว`,
        deliveryStatus: "QUEUED",
        maxAttempts: 3,
        idempotencyKey: notification.idempotencyKey ? notification.idempotencyKey + "_tg" : ""
      });
      this.telegramRepo.create(tg, actor);
      outputs.push("TELEGRAM");
    }

    if (channels.indexOf("EMAIL") !== -1) {
      const email = new EmailQueueItemEntity({
        emailQueueId: CMPE_UTILITIES.generateUuid(),
        tenantId: actor.tenantId,
        notificationId: notification.notificationId,
        recipientEmail: recipientAddress.email || "recipient@sesao-sakon.go.th",
        subject: `[CMPE Alert] ${notification.notificationCode}`,
        textBody: `รายการรหัสข้อความแจ้งเตือน: ${notification.notificationCode} ได้รับการบันทึกสถานะเรียบร้อยแล้ว`,
        deliveryStatus: "QUEUED",
        maxAttempts: 3,
        idempotencyKey: notification.idempotencyKey ? notification.idempotencyKey + "_email" : ""
      });
      this.emailRepo.create(email, actor);
      outputs.push("EMAIL");
    }

    if (channels.indexOf("SMS") !== -1) {
      const sms = new SmsQueueItemEntity({
        smsQueueId: CMPE_UTILITIES.generateUuid(),
        tenantId: actor.tenantId,
        notificationId: notification.notificationId,
        recipientPhone: recipientAddress.phone || "0812345678",
        renderedMessage: `[CMPE Alert]: ${notification.notificationCode}`,
        deliveryStatus: "QUEUED",
        maxAttempts: 3,
        idempotencyKey: notification.idempotencyKey ? notification.idempotencyKey + "_sms" : ""
      });
      this.smsRepo.create(sms, actor);
      outputs.push("SMS");
    }

    return outputs;
  }
}

class TelegramQueueService {
  constructor(telegramRepo) {
    this.telegramRepo = telegramRepo;
  }

  processTelegramQueue(batchSize, actor) {
    const items = this.telegramRepo.leaseDueItems(batchSize, actor.tenantId);
    let successCount = 0;
    
    items.forEach(item => {
      item.attemptCount++;
      item.lastAttemptTimestamp = new Date().toISOString();

      const token = CMPE_ENVIRONMENT.getTelegramBotToken();
      if (!token) {
        item.deliveryStatus = "FAILED";
        item.lastErrorCode = "ERR_TELEGRAM_NOT_CONFIGURED";
        item.lastErrorMessage = "TELEGRAM_BOT_TOKEN is not configured.";
      } else {
        try {
          const response = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "post",
            contentType: "application/json",
            payload: JSON.stringify({
              chat_id: item.chatIdReference,
              text: item.renderedMessage,
              parse_mode: item.parseMode || "HTML"
            }),
            muteHttpExceptions: true
          });
          const body = JSON.parse(response.getContentText() || "{}");
          if (response.getResponseCode() >= 200 && response.getResponseCode() < 300 && body.ok) {
            item.deliveryStatus = "DELIVERED";
            item.deliveredTimestamp = new Date().toISOString();
            item.providerMessageId = String(body.result && body.result.message_id || "");
            item.providerResponseCode = response.getResponseCode();
            successCount++;
          } else {
            item.deliveryStatus = "FAILED";
            item.lastErrorCode = "ERR_TELEGRAM_PROVIDER";
            item.lastErrorMessage = String(body.description || `HTTP ${response.getResponseCode()}`).slice(0, 500);
            item.providerResponseCode = response.getResponseCode();
          }
        } catch (error) {
          item.deliveryStatus = "FAILED";
          item.lastErrorCode = "ERR_TELEGRAM_NETWORK";
          item.lastErrorMessage = String(error).slice(0, 500);
        }
      }
      if (item.deliveryStatus === "FAILED") {
        item.nextAttemptTimestamp = new Date(Date.now() + Math.pow(2, item.attemptCount) * 60000).toISOString();
        if (item.attemptCount >= item.maxAttempts) {
          item.deliveryStatus = "DEAD_LETTER";
          item.failureCategory = "PROVIDER_ERROR";
        }
      }

      this.telegramRepo.update(item, item.rowVersion, actor);
    });

    return successCount;
  }
}

class EmailQueueService {
  constructor(emailRepo) {
    this.emailRepo = emailRepo;
  }

  processEmailQueue(batchSize, actor) {
    const items = this.emailRepo.leaseDueItems(batchSize, actor.tenantId);
    let successCount = 0;

    items.forEach(item => {
      item.attemptCount++;
      item.lastAttemptTimestamp = new Date().toISOString();

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.recipientEmail || "")) {
        item.deliveryStatus = "FAILED";
        item.lastErrorCode = "ERR_EMAIL_INVALID_ADDRESS";
        item.lastErrorMessage = "The email destination address syntax is incorrect.";
      } else {
        try {
          MailApp.sendEmail({
            to: item.recipientEmail,
            subject: item.subject || "",
            body: item.textBody || "",
            htmlBody: item.htmlBody || undefined,
            name: "CMPE Competition Platform"
          });
          item.deliveryStatus = "DELIVERED";
          item.deliveredTimestamp = new Date().toISOString();
          item.providerMessageId = CMPE_UTILITIES.generateUuid();
          successCount++;
        } catch (error) {
          item.deliveryStatus = "FAILED";
          item.lastErrorCode = "ERR_EMAIL_PROVIDER";
          item.lastErrorMessage = String(error).slice(0, 500);
        }
      }
      if (item.deliveryStatus === "FAILED") {
        item.nextAttemptTimestamp = new Date(Date.now() + Math.pow(2, item.attemptCount) * 60000).toISOString();
        if (item.attemptCount >= item.maxAttempts) {
          item.deliveryStatus = "DEAD_LETTER";
          item.failureCategory = "PERMANENT_RECIPIENT_ERROR";
        }
      }

      this.emailRepo.update(item, item.rowVersion, actor);
    });

    return successCount;
  }
}

class SmsQueueService {
  constructor(smsRepo) {
    this.smsRepo = smsRepo;
  }

  processSmsQueue(batchSize, actor) {
    const items = this.smsRepo.leaseDueItems(batchSize, actor.tenantId);
    let successCount = 0;

    items.forEach(item => {
      item.attemptCount++;
      item.lastAttemptTimestamp = new Date().toISOString();
      const props = PropertiesService.getScriptProperties();
      const providerUrl = props.getProperty("SMS_PROVIDER_URL");
      const providerToken = props.getProperty("SMS_PROVIDER_TOKEN");
      if (!providerUrl || !providerToken) {
        item.deliveryStatus = "FAILED";
        item.lastErrorCode = "ERR_SMS_PROVIDER_DISABLED";
        item.lastErrorMessage = "SMS provider URL or token is not configured.";
      } else {
        try {
          const response = UrlFetchApp.fetch(providerUrl, {
            method: "post",
            contentType: "application/json",
            headers: { Authorization: `Bearer ${providerToken}` },
            payload: JSON.stringify({
              to: item.recipientPhone,
              message: item.renderedMessage
            }),
            muteHttpExceptions: true
          });
          item.providerResponseCode = response.getResponseCode();
          if (response.getResponseCode() >= 200 && response.getResponseCode() < 300) {
            item.deliveryStatus = "DELIVERED";
            item.deliveredTimestamp = new Date().toISOString();
            const result = JSON.parse(response.getContentText() || "{}");
            item.providerMessageId = String(result.messageId || result.id || "");
            successCount++;
          } else {
            item.deliveryStatus = "FAILED";
            item.lastErrorCode = "ERR_SMS_PROVIDER";
            item.lastErrorMessage = response.getContentText().slice(0, 500);
          }
        } catch (error) {
          item.deliveryStatus = "FAILED";
          item.lastErrorCode = "ERR_SMS_NETWORK";
          item.lastErrorMessage = String(error).slice(0, 500);
        }
      }
      if (item.deliveryStatus === "FAILED") {
        item.nextAttemptTimestamp = new Date(Date.now() + Math.pow(2, item.attemptCount) * 60000).toISOString();
      }
      if (item.attemptCount >= item.maxAttempts) {
        item.deliveryStatus = "DEAD_LETTER";
        item.failureCategory = "CONFIGURATION_ERROR";
      }
      this.smsRepo.update(item, item.rowVersion, actor);
    });

    return successCount;
  }
}

class StaleNotificationService {
  constructor(notifyRepo, tgRepo, emailRepo, smsRepo) {
    this.notifyRepo = notifyRepo;
    this.tgRepo = tgRepo;
    this.emailRepo = emailRepo;
    this.smsRepo = smsRepo;
  }

  detectAndMarkStale(sourceEntityType, sourceEntityId, newVersion, tenantId) {
    const sheet = this.notifyRepo.getSheet();
    if (sheet.getLastRow() <= 1) return 0;

    const headerMap = this.notifyRepo.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const typeCol = headerMap["sourceEntityType"] - 1;
    const idCol = headerMap["sourceEntityId"] - 1;
    const verCol = headerMap["sourceVersion"] - 1;
    const statusCol = headerMap["notificationStatus"] - 1;
    const tenantCol = headerMap["tenantId"] - 1;
    const rowVerCol = headerMap["rowVersion"] - 1;

    let staleCount = 0;

    for (let i = 0; i < data.length; i++) {
      if (data[i][typeCol] === sourceEntityType && 
          data[i][idCol] === sourceEntityId && 
          data[i][tenantCol] === tenantId && 
          data[i][statusCol] !== "STALE" && 
          parseInt(data[i][verCol]) < newVersion) {
        
        const rowNum = i + 2;
        sheet.getRange(rowNum, statusCol + 1).setValue("STALE");
        sheet.getRange(rowNum, rowVerCol + 1).setValue((parseInt(data[i][rowVerCol]) || 1) + 1);
        staleCount++;

        // Cancel associated channel queues
        const notificationId = data[i][headerMap["notificationId"] - 1];
        this.cancelPendingQueueItems(notificationId);
      }
    }

    return staleCount;
  }

  cancelPendingQueueItems(notificationId) {
    // Cancel telegram queue
    const tgSheet = this.tgRepo.getSheet();
    if (tgSheet.getLastRow() > 1) {
      const headerMap = this.tgRepo.getHeaderMap(tgSheet);
      const data = tgSheet.getRange(2, 1, tgSheet.getLastRow() - 1, tgSheet.getLastColumn()).getValues();
      const nCol = headerMap["notificationId"] - 1;
      const statusCol = headerMap["deliveryStatus"] - 1;
      for (let i = 0; i < data.length; i++) {
        if (data[i][nCol] === notificationId && data[i][statusCol] === "QUEUED") {
          tgSheet.getRange(i + 2, statusCol + 1).setValue("STALE");
        }
      }
    }

    // Cancel email queue
    const emSheet = this.emailRepo.getSheet();
    if (emSheet.getLastRow() > 1) {
      const headerMap = this.emailRepo.getHeaderMap(emSheet);
      const data = emSheet.getRange(2, 1, emSheet.getLastRow() - 1, emSheet.getLastColumn()).getValues();
      const nCol = headerMap["notificationId"] - 1;
      const statusCol = headerMap["deliveryStatus"] - 1;
      for (let i = 0; i < data.length; i++) {
        if (data[i][nCol] === notificationId && data[i][statusCol] === "QUEUED") {
          emSheet.getRange(i + 2, statusCol + 1).setValue("STALE");
        }
      }
    }

    // Cancel SMS queue
    const smsSheet = this.smsRepo.getSheet();
    if (smsSheet.getLastRow() > 1) {
      const headerMap = this.smsRepo.getHeaderMap(smsSheet);
      const data = smsSheet.getRange(2, 1, smsSheet.getLastRow() - 1, smsSheet.getLastColumn()).getValues();
      const nCol = headerMap["notificationId"] - 1;
      const statusCol = headerMap["deliveryStatus"] - 1;
      for (let i = 0; i < data.length; i++) {
        if (data[i][nCol] === notificationId && data[i][statusCol] === "QUEUED") {
          smsSheet.getRange(i + 2, statusCol + 1).setValue("STALE");
        }
      }
    }
  }
}
