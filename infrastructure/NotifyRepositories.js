/**
 * Competition Platform Engineering Standards (CPES)
 * Stage 9 - Notification Repositories
 */

class NotificationRepository extends BaseRepository {
  constructor() {
    super("notifications");
  }

  findByIdempotencyKey(key, tenantId) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return null;
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const keyCol = headerMap["idempotencyKey"] - 1;
    const tenantCol = headerMap["tenantId"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    for (let i = 0; i < data.length; i++) {
      if (data[i][keyCol] === key && data[i][tenantCol] === tenantId && data[i][statusCol] !== "DELETED") {
        return this.mapRowToObject(data[i], headerMap);
      }
    }
    return null;
  }
}

class TelegramQueueRepository extends BaseRepository {
  constructor() {
    super("telegram_queue");
  }

  leaseDueItems(batchSize, tenantId) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return [];
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const statusCol = headerMap["deliveryStatus"] - 1;
    const tenantCol = headerMap["tenantId"] - 1;
    const recCol = headerMap["recordStatus"] - 1;
    const attemptCol = headerMap["attemptCount"] - 1;
    const maxCol = headerMap["maxAttempts"] - 1;
    
    const items = [];
    for (let i = 0; i < data.length; i++) {
      const status = data[i][statusCol];
      const attemptCount = parseInt(data[i][attemptCol]) || 0;
      const maxAttempts = parseInt(data[i][maxCol]) || 5;
      
      const isDue = status === "QUEUED" || (status === "FAILED" && attemptCount < maxAttempts);
      if (isDue && data[i][tenantCol] === tenantId && data[i][recCol] !== "DELETED") {
        items.push(this.mapRowToObject(data[i], headerMap));
        if (items.length >= batchSize) break;
      }
    }
    return items;
  }
}

class EmailQueueRepository extends BaseRepository {
  constructor() {
    super("email_queue");
  }

  leaseDueItems(batchSize, tenantId) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return [];
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const statusCol = headerMap["deliveryStatus"] - 1;
    const tenantCol = headerMap["tenantId"] - 1;
    const recCol = headerMap["recordStatus"] - 1;
    const attemptCol = headerMap["attemptCount"] - 1;
    const maxCol = headerMap["maxAttempts"] - 1;
    
    const items = [];
    for (let i = 0; i < data.length; i++) {
      const status = data[i][statusCol];
      const attemptCount = parseInt(data[i][attemptCol]) || 0;
      const maxAttempts = parseInt(data[i][maxCol]) || 5;
      
      const isDue = status === "QUEUED" || (status === "FAILED" && attemptCount < maxAttempts);
      if (isDue && data[i][tenantCol] === tenantId && data[i][recCol] !== "DELETED") {
        items.push(this.mapRowToObject(data[i], headerMap));
        if (items.length >= batchSize) break;
      }
    }
    return items;
  }
}

class SmsQueueRepository extends BaseRepository {
  constructor() {
    super("sms_queue");
  }

  leaseDueItems(batchSize, tenantId) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return [];
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const statusCol = headerMap["deliveryStatus"] - 1;
    const tenantCol = headerMap["tenantId"] - 1;
    const recCol = headerMap["recordStatus"] - 1;
    const attemptCol = headerMap["attemptCount"] - 1;
    const maxCol = headerMap["maxAttempts"] - 1;
    
    const items = [];
    for (let i = 0; i < data.length; i++) {
      const status = data[i][statusCol];
      const attemptCount = parseInt(data[i][attemptCol]) || 0;
      const maxAttempts = parseInt(data[i][maxCol]) || 5;
      
      const isDue = status === "QUEUED" || (status === "FAILED" && attemptCount < maxAttempts);
      if (isDue && data[i][tenantCol] === tenantId && data[i][recCol] !== "DELETED") {
        items.push(this.mapRowToObject(data[i], headerMap));
        if (items.length >= batchSize) break;
      }
    }
    return items;
  }
}
