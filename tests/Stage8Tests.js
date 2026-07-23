/**
 * Competition Platform Engineering Standards (CPES)
 * Stage 8 - Certificate Generation & QR Verification Tests
 */

const CMPE_STAGE8_TESTS = {
  runTests() {
    const results = {
      timestamp: new Date().toISOString(),
      status: "PASSED",
      total: 0,
      passed: 0,
      failed: 0,
      failures: []
    };

    function assert(condition, message) {
      results.total++;
      if (condition) {
        results.passed++;
      } else {
        results.failed++;
        results.status = "FAILED";
        results.failures.push(message);
      }
    }

    const tenantId = "SESAO_SAKON";
    const actorContext = { userId: "ADMIN_USER_1", tenantId: tenantId, roles: ["AREA_ADMIN"] };

    const certRepo = new CertificateRepository();
    const verifyRepo = new CertificateVerificationRepository();
    const downloadRepo = new CertificateDownloadRepository();

    const numSvc = new CertificateNumberService();
    const eligSvc = new CertificateEligibilityService(new ScoreSummaryRepository());

    const genSvc = new CertificateGenerationService(certRepo, verifyRepo, numSvc, eligSvc);
    const verifySvc = new CertificateVerificationService(verifyRepo, certRepo);
    const revokeSvc = new CertificateRevocationService(certRepo, verifyRepo);
    const regenSvc = new CertificateRegenerationService(certRepo, verifyRepo, genSvc);
    const downloadSvc = new CertificateDownloadService(downloadRepo);

    Logger.log("--- Starting Stage 8 Certificate & Verification Tests ---");

    // Clean old test records
    try {
      const cSheet = certRepo.getSheet();
      if (cSheet.getLastRow() > 1) {
        const data = cSheet.getRange(2, 1, cSheet.getLastRow() - 1, cSheet.getLastColumn()).getValues();
        const headerMap = certRepo.getHeaderMap(cSheet);
        const nameCol = headerMap["recipientNameSnapshot"] - 1;
        for (let i = data.length - 1; i >= 0; i--) {
          if (data[i][nameCol] && data[i][nameCol].indexOf("เกียรติยศ") === 0) {
            cSheet.deleteRow(i + 2);
          }
        }
      }
    } catch (e) {}

    // 1. Test Certificate Generation & Snapshots
    let certId = "CRT_TEST_01";
    let token = "";
    try {
      const payload = {
        certificateId: certId,
        recipientReferenceId: "REG_STAGE7_TEST",
        recipientType: "PARTICIPANT",
        recipientNameSnapshot: "เกียรติยศ รักเรียน",
        schoolNameSnapshot: "โรงเรียนวิทยาศาสตร์พระราชดำริ",
        competitionNameSnapshot: "โครงงานหุ่นยนต์ ก.พ.ด. 2569",
        tenantId: tenantId
      };
      const created = genSvc.generateSingleCertificate(payload, actorContext);
      assert(created.certificateStatus === "ACTIVE", "Certificate status mismatch: " + created.certificateStatus);
      assert(created.certificateNumber.indexOf(`CERT-${tenantId}-2569-`) === 0, "Allocated number format invalid: " + created.certificateNumber);
      assert(created.pdfFileId, "Certificate PDF file was not created");
      assert(created.recipientNameSnapshot === "เกียรติยศ รักเรียน", "Snapshot name mismatch: " + created.recipientNameSnapshot);
      token = created.verificationToken;
    } catch (e) {
      assert(false, "Certificate generation failed: " + e.toString());
    }

    // 2. Test Public Verification Lookup
    try {
      const verRes = verifySvc.verifyPublicToken(token);
      assert(verRes.status === "VALID", "Verification status mismatch: " + verRes.status);
      assert(verRes.display.recipientName === "เกียรติยศ รักเรียน", "Verification public display name invalid");

      // Verify unknown token returns error
      try {
        verifySvc.verifyPublicToken("UNKNOWN_TOKEN_XYZ");
        assert(false, "Allowed verification of invalid token");
      } catch (err) {
        assert(err.message.indexOf("ERR_CERT_NOT_FOUND") !== -1, "Unknown token check failed");
      }
    } catch (e) {
      assert(false, "Public verification tests failed: " + e.toString());
    }

    // 3. Test Revocation Workflow
    try {
      // Rejects without reason:
      try {
        revokeSvc.revokeCertificate(certId, "", actorContext);
        assert(false, "Allowed revocation without reason");
      } catch (err) {
        assert(err.message.indexOf("ERR_REVOCATION_REASON_REQUIRED") !== -1, "Revocation reason check failed");
      }

      // Successful revocation:
      const revoked = revokeSvc.revokeCertificate(certId, "ข้อผิดพลาดการกรอกสะกดชื่อจริง", actorContext);
      assert(revoked.certificateStatus === "REVOKED", "Status was not updated to REVOKED");

      const verRes = verifySvc.verifyPublicToken(token);
      assert(verRes.status === "REVOKED", "Public verification status was not updated to REVOKED: " + verRes.status);
    } catch (e) {
      assert(false, "Revocation tests failed: " + e.toString());
    }

    // 4. Test Controlled Regeneration (Lineage & Superseding)
    try {
      // Rejects without reason:
      try {
        regenSvc.regenerateCertificate(certId, "", actorContext);
        assert(false, "Allowed regeneration without reason");
      } catch (err) {
        assert(err.message.indexOf("ERR_REGEN_REASON_REQUIRED") !== -1, "Regeneration reason check failed");
      }

      // Successful regeneration:
      const newCert = regenSvc.regenerateCertificate(certId, "ชื่อสกุลเด็กมีตัวสะกดตกหล่น", actorContext);
      assert(newCert.certificateStatus === "ACTIVE", "Regenerated certificate status mismatch");
      assert(newCert.supersedesCertificateId === certId, "Lineage supersedes ID mismatch");

      // Check that the old certificate is now SUPERSEDED
      const oldCert = certRepo.findById(certId, tenantId);
      assert(oldCert.certificateStatus === "SUPERSEDED", "Old certificate status was not updated to SUPERSEDED");

      const oldVer = verifySvc.verifyPublicToken(token);
      assert(oldVer.status === "SUPERSEDED", "Old public verification status was not updated to SUPERSEDED");
    } catch (e) {
      assert(false, "Regeneration tests failed: " + e.toString());
    }

    // 5. Test Download Logging
    try {
      const logged = downloadSvc.logDownload(certId, "SCHOOL_USER", actorContext);
      assert(logged.accessType === "SCHOOL_USER", "Download log accessType mismatch");
    } catch (e) {
      assert(false, "Download logging tests failed: " + e.toString());
    }

    return results;
  }
};
