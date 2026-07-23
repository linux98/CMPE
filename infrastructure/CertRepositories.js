/**
 * Competition Platform Engineering Standards (CPES)
 * Stage 8 - Certificate & Verification Repositories
 */

class CertificateRepository extends BaseRepository {
  constructor() {
    super("certificates");
  }

  findByNumber(certNumber, tenantId) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return null;
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const numCol = headerMap["certificateNumber"] - 1;
    const tenantCol = headerMap["tenantId"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    for (let i = 0; i < data.length; i++) {
      if (data[i][numCol] === certNumber && data[i][tenantCol] === tenantId && data[i][statusCol] !== "DELETED") {
        return this.mapRowToObject(data[i], headerMap);
      }
    }
    return null;
  }

  findByRecipient(recipientId, tenantId) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return [];
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const recCol = headerMap["recipientReferenceId"] - 1;
    const tenantCol = headerMap["tenantId"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    const list = [];
    data.forEach(row => {
      if (row[recCol] === recipientId && row[tenantCol] === tenantId && row[statusCol] !== "DELETED") {
        list.push(this.mapRowToObject(row, headerMap));
      }
    });
    return list;
  }
}

class CertificateVerificationRepository extends BaseRepository {
  constructor() {
    super("certificate_verification");
  }

  findByToken(token) {
    const sheet = this.getSheet();
    if (sheet.getLastRow() <= 1) return null;
    
    const headerMap = this.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const tokCol = headerMap["verificationToken"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    for (let i = 0; i < data.length; i++) {
      if (data[i][tokCol] === token && data[i][statusCol] !== "DELETED") {
        return this.mapRowToObject(data[i], headerMap);
      }
    }
    return null;
  }
}

class CertificateDownloadRepository extends BaseRepository {
  constructor() {
    super("certificate_downloads");
  }
}
