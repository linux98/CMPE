/**
 * Competition Platform Engineering Standards (CPES)
 * Stage 8 - Certificate & Verification Services
 */

class CertificateNumberService {
  generateCertificateNumber(tenantId, year) {
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const props = PropertiesService.getScriptProperties();
      const key = `CERT_SEQUENCE_${tenantId}_${year}`;
      const next = (parseInt(props.getProperty(key), 10) || 0) + 1;
      props.setProperty(key, String(next));
      return `CERT-${tenantId}-${year}-${String(next).padStart(6, "0")}`;
    } finally {
      lock.releaseLock();
    }
  }
}

class CertificateEligibilityService {
  constructor(summaryRepo) {
    this.summaryRepo = summaryRepo;
  }

  validateEligibility(recipientId, recipientType, tenantId) {
    const type = String(recipientType || "").toUpperCase();
    if (["REGISTRATION", "TEAM", "PARTICIPANT"].indexOf(type) === -1) {
      return { eligible: false, blockingReasons: ["Unsupported certificate recipient type."] };
    }
    const summary = this.summaryRepo.findByRegistration(recipientId, tenantId);
    if (!summary) {
      return { eligible: false, blockingReasons: ["No score summary exists for this registration."] };
    }
    if (["VERIFIED", "HARD_LOCKED"].indexOf(summary.summaryStatus) === -1) {
      return { eligible: false, blockingReasons: ["The result has not been verified."] };
    }
    return {
      eligible: true,
      blockingReasons: [],
      scoreSummary: summary
    };
  }
}

class CertificateGenerationService {
  constructor(certRepo, verifyRepo, numberSvc, eligibilitySvc) {
    this.certRepo = certRepo;
    this.verifyRepo = verifyRepo;
    this.numberSvc = numberSvc;
    this.eligibilitySvc = eligibilitySvc;
  }

  generateSingleCertificate(payload, actor) {
    const elig = this.eligibilitySvc.validateEligibility(payload.recipientReferenceId, payload.recipientType, actor.tenantId);
    if (!elig.eligible) {
      throw new Error("ERR_CERT_NOT_ELIGIBLE: Recipient is not eligible for certificate generation.");
    }

    // Allocate certificate number
    const certYear = payload.academicYearSnapshot || CMPE_ENVIRONMENT.getAcademicYear();
    const certNum = this.numberSvc.generateCertificateNumber(actor.tenantId, certYear);
    const token = CMPE_UTILITIES.generateUuid();
    
    // Create Certificate Snapshot
    const cert = new CertificateEntity(payload);
    cert.certificateId = payload.certificateId || CMPE_UTILITIES.generateUuid();
    cert.tenantId = actor.tenantId;
    cert.certificateNumber = certNum;
    cert.certificateVersion = 1;
    cert.recipientNameSnapshot = payload.recipientNameSnapshot || "สมชาย ใจดี";
    cert.schoolNameSnapshot = payload.schoolNameSnapshot || "โรงเรียนวิทยาศาสตร์พระราชดำริ";
    cert.competitionNameSnapshot = payload.competitionNameSnapshot || "โครงงานหุ่นยนต์ ก.พ.ด. 2569";
    cert.recipientNameSnapshot = payload.recipientNameSnapshot || "";
    cert.schoolNameSnapshot = payload.schoolNameSnapshot || "";
    cert.competitionNameSnapshot = payload.competitionNameSnapshot || "";
    if (!cert.recipientNameSnapshot || !cert.competitionNameSnapshot) {
      throw new Error("ERR_CERT_SNAPSHOT_REQUIRED: Recipient and competition names are required.");
    }
    cert.finalScoreSnapshot = payload.finalScoreSnapshot !== undefined
      ? payload.finalScoreSnapshot
      : elig.scoreSummary.averageScore;
    cert.medalTierSnapshot = payload.medalTierSnapshot || elig.scoreSummary.medalTier;
    cert.verificationToken = token;
    cert.verificationHash = CMPE_UTILITIES.hashPassword(cert.recipientNameSnapshot, token); // Using simple secure bind hash
    cert.integrityChecksum = CMPE_UTILITIES.hashPassword(certNum + cert.recipientNameSnapshot, token);
    const webAppUrl = ScriptApp.getService().getUrl() || "";
    cert.qrPayload = `${webAppUrl}?v=${encodeURIComponent(token)}`;
    cert.pdfFileName = `${certNum}_${sanitizeFileName_(cert.recipientNameSnapshot)}.pdf`;
    const pdfFile = createCertificatePdf_(cert);
    cert.pdfFileId = pdfFile.getId();
    cert.pdfMimeType = MimeType.PDF;
    
    cert.generationStatus = "GENERATED";
    cert.certificateStatus = "ACTIVE";
    cert.activatedTimestamp = new Date().toISOString();
    cert.rowVersion = 1;

    const createdCert = this.certRepo.create(cert, actor);

    // Write verification identity record
    const ver = new CertificateVerificationEntity({
      certificateVerificationId: CMPE_UTILITIES.generateUuid(),
      tenantId: actor.tenantId,
      certificateId: createdCert.certificateId,
      verificationToken: token,
      verificationHash: cert.verificationHash,
      integrityChecksum: cert.integrityChecksum,
      verificationStatus: "VALID",
      publicDisplayJson: JSON.stringify({
        certificateNumber: certNum,
        recipientName: cert.recipientNameSnapshot,
        schoolName: cert.schoolNameSnapshot,
        competitionName: cert.competitionNameSnapshot,
        status: "VALID"
      }),
      issuedTimestamp: new Date().toISOString(),
      activatedTimestamp: new Date().toISOString(),
      resultVersion: "v1",
      certificateVersion: 1
    });
    this.verifyRepo.create(ver, actor);

    return createdCert;
  }
}

function sanitizeFileName_(value) {
  return String(value || "certificate").replace(/[\\/:*?"<>|]+/g, "_").trim();
}

function escapeHtml_(value) {
  return String(value === undefined || value === null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createCertificatePdf_(cert) {
  const html = [
    "<!doctype html><html><head><meta charset='UTF-8'><style>",
    "@page{size:A4 landscape;margin:18mm}",
    "body{font-family:Arial,'Noto Sans Thai',sans-serif;text-align:center;color:#172554}",
    ".frame{border:8px double #1d4ed8;padding:38px;min-height:480px}",
    "h1{font-size:34px;margin:10px}.name{font-size:30px;font-weight:bold;color:#7c2d12}",
    ".meta{font-size:18px;line-height:1.7}.number{margin-top:36px;font-size:13px;color:#475569}",
    "</style></head><body><div class='frame'>",
    "<h1>เกียรติบัตร</h1><p>ขอมอบเกียรติบัตรฉบับนี้ให้ไว้เพื่อแสดงว่า</p>",
    `<div class='name'>${escapeHtml_(cert.recipientNameSnapshot)}</div>`,
    `<div class='meta'>${escapeHtml_(cert.schoolNameSnapshot)}<br>`,
    `เข้าร่วม ${escapeHtml_(cert.competitionNameSnapshot)}<br>`,
    `ผลคะแนน ${escapeHtml_(cert.finalScoreSnapshot)} ระดับ ${escapeHtml_(cert.medalTierSnapshot)}</div>`,
    `<div class='number'>เลขที่ ${escapeHtml_(cert.certificateNumber)}<br>`,
    `ตรวจสอบ: ${escapeHtml_(cert.qrPayload)}</div>`,
    "</div></body></html>"
  ].join("");
  const pdfBlob = Utilities.newBlob(html, MimeType.HTML, "certificate.html")
    .getAs(MimeType.PDF)
    .setName(cert.pdfFileName);
  const folderId = PropertiesService.getScriptProperties().getProperty("CERTIFICATE_FOLDER_ID");
  return folderId
    ? DriveApp.getFolderById(folderId).createFile(pdfBlob)
    : DriveApp.createFile(pdfBlob);
}

class CertificateVerificationService {
  constructor(verifyRepo, certRepo) {
    this.verifyRepo = verifyRepo;
    this.certRepo = certRepo;
  }

  verifyPublicToken(token) {
    const ver = this.verifyRepo.findByToken(token);
    if (!ver) {
      throw new Error("ERR_CERT_NOT_FOUND: The requested verification token was not found.");
    }

    if (ver.verificationStatus === "REVOKED") {
      return {
        status: "REVOKED",
        display: null
      };
    }

    if (ver.verificationStatus === "SUPERSEDED") {
      return {
        status: "SUPERSEDED",
        display: null
      };
    }

    // Verify Hash integrity:
    const display = JSON.parse(ver.publicDisplayJson);
    const expectedHash = CMPE_UTILITIES.hashPassword(display.recipientName, token);
    if (ver.verificationHash !== expectedHash) {
      return {
        status: "INVALID_INTEGRITY",
        display: null
      };
    }

    return {
      status: "VALID",
      display: display
    };
  }
}

class CertificateRevocationService {
  constructor(certRepo, verifyRepo) {
    this.certRepo = certRepo;
    this.verifyRepo = verifyRepo;
  }

  revokeCertificate(certificateId, reason, actor) {
    if (!reason) throw new Error("ERR_REVOCATION_REASON_REQUIRED");

    const cert = this.certRepo.findById(certificateId, actor.tenantId);
    if (!cert) throw new Error("ERR_CERT_NOT_FOUND");

    cert.certificateStatus = "REVOKED";
    cert.revokedTimestamp = new Date().toISOString();
    cert.revokedBy = actor.userId;
    cert.revocationReason = reason;
    this.certRepo.update(cert, cert.rowVersion, actor);

    // Update verification table
    const ver = this.verifyRepo.getSheet();
    if (ver.getLastRow() > 1) {
      const headerMap = this.verifyRepo.getHeaderMap(ver);
      const data = ver.getRange(2, 1, ver.getLastRow() - 1, ver.getLastColumn()).getValues();
      const certCol = headerMap["certificateId"] - 1;
      const statusCol = headerMap["verificationStatus"] - 1;
      const jsonCol = headerMap["publicDisplayJson"] - 1;
      const rowVerCol = headerMap["rowVersion"] - 1;
      
      for (let i = 0; i < data.length; i++) {
        if (data[i][certCol] === certificateId) {
          const rowNum = i + 2;
          const displayObj = JSON.parse(data[i][jsonCol]);
          displayObj.status = "REVOKED";
          
          ver.getRange(rowNum, statusCol + 1).setValue("REVOKED");
          ver.getRange(rowNum, jsonCol + 1).setValue(JSON.stringify(displayObj));
          ver.getRange(rowNum, rowVerCol + 1).setValue((parseInt(data[i][rowVerCol]) || 1) + 1);
          break;
        }
      }
    }

    return cert;
  }
}

class CertificateRegenerationService {
  constructor(certRepo, verifyRepo, generationSvc) {
    this.certRepo = certRepo;
    this.verifyRepo = verifyRepo;
    this.generationSvc = generationSvc;
  }

  regenerateCertificate(certificateId, reason, actor) {
    if (!reason) throw new Error("ERR_REGEN_REASON_REQUIRED");

    const oldCert = this.certRepo.findById(certificateId, actor.tenantId);
    if (!oldCert) throw new Error("ERR_CERT_NOT_FOUND");

    // Supersede old cert
    oldCert.certificateStatus = "SUPERSEDED";
    this.certRepo.update(oldCert, oldCert.rowVersion, actor);

    // Mark verification superseded
    const ver = this.verifyRepo.getSheet();
    if (ver.getLastRow() > 1) {
      const headerMap = this.verifyRepo.getHeaderMap(ver);
      const data = ver.getRange(2, 1, ver.getLastRow() - 1, ver.getLastColumn()).getValues();
      const certCol = headerMap["certificateId"] - 1;
      const statusCol = headerMap["verificationStatus"] - 1;
      const jsonCol = headerMap["publicDisplayJson"] - 1;
      const rowVerCol = headerMap["rowVersion"] - 1;
      
      for (let i = 0; i < data.length; i++) {
        if (data[i][certCol] === certificateId) {
          const rowNum = i + 2;
          const displayObj = JSON.parse(data[i][jsonCol]);
          displayObj.status = "SUPERSEDED";
          
          ver.getRange(rowNum, statusCol + 1).setValue("SUPERSEDED");
          ver.getRange(rowNum, jsonCol + 1).setValue(JSON.stringify(displayObj));
          ver.getRange(rowNum, rowVerCol + 1).setValue((parseInt(data[i][rowVerCol]) || 1) + 1);
          break;
        }
      }
    }

    // Generate new version
    const payload = {
      recipientReferenceId: oldCert.recipientReferenceId,
      recipientType: oldCert.recipientType,
      recipientNameSnapshot: oldCert.recipientNameSnapshot + " (ฉบับแก้ไข)",
      schoolNameSnapshot: oldCert.schoolNameSnapshot,
      competitionNameSnapshot: oldCert.competitionNameSnapshot,
      supersedesCertificateId: certificateId
    };

    return this.generationSvc.generateSingleCertificate(payload, actor);
  }
}

class CertificateDownloadService {
  constructor(downloadRepo) {
    this.downloadRepo = downloadRepo;
  }

  logDownload(certificateId, accessType, actor) {
    const dl = new CertificateDownloadEntity({
      certificateDownloadId: CMPE_UTILITIES.generateUuid(),
      tenantId: actor.tenantId,
      certificateId: certificateId,
      downloadTimestamp: new Date().toISOString(),
      downloadedBy: actor.userId,
      accessType: accessType,
      downloadResult: "SUCCESS"
    });
    return this.downloadRepo.create(dl, actor);
  }
}
