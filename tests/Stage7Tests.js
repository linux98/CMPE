/**
 * Competition Platform Engineering Standards (CPES)
 * Stage 7 - Scoring & Evaluation Unit/Integration Tests
 */

const CMPE_STAGE7_TESTS = {
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
    const actorContext = { userId: "JUDGE_USER_1", tenantId: tenantId, roles: ["SCORE_JUDGE"] };
    const chiefContext = { userId: "CHIEF_USER_1", tenantId: tenantId, roles: ["CHIEF_JUDGE"] };

    const scRepo = new ScorecardRepository();
    const detailRepo = new ScoreDetailRepository();
    const summaryRepo = new ScoreSummaryRepository();
    const historyRepo = new ScoreLockHistoryRepository();
    const medalRepo = new MedalRepository();
    const appealRepo = new AppealRepository();

    const scAppSvc = new ScorecardApplicationService(scRepo, detailRepo);
    const aggSvc = new ScorePanelAggregationService(scRepo, detailRepo, summaryRepo, medalRepo);
    const verifySvc = new ChiefJudgeVerificationService(scRepo, summaryRepo);
    const lockSvc = new ResultLockApplicationService(summaryRepo, historyRepo);
    const appealSvc = new AppealApplicationService(appealRepo);

    Logger.log("--- Starting Stage 7 Scoring & Evaluation Tests ---");

    // Clean old test records
    try {
      const scSheet = scRepo.getSheet();
      if (scSheet.getLastRow() > 1) {
        const data = scSheet.getRange(2, 1, scSheet.getLastRow() - 1, scSheet.getLastColumn()).getValues();
        const headerMap = scRepo.getHeaderMap(scSheet);
        const regCol = headerMap["registrationId"] - 1;
        for (let i = data.length - 1; i >= 0; i--) {
          if (data[i][regCol] === "REG_STAGE7_TEST") {
            scSheet.deleteRow(i + 2);
          }
        }
      }
    } catch (e) {}

    // 1. Test Scorecard Initialization & Unique constraints
    let scId = "SC_TEST_01";
    let regId = "REG_STAGE7_TEST";
    try {
      const initPayload = {
        scorecardId: scId,
        registrationId: regId,
        judgeId: "JDG_TEST_01",
        scoreTemplateId: "TEMP_STAGE4_TEST",
        tenantId: tenantId
      };
      scAppSvc.initializeScorecard(initPayload, actorContext);

      // Unique check: initializing again for same judge and registration should fail!
      try {
        scAppSvc.initializeScorecard(initPayload, actorContext);
        assert(false, "Allowed duplicate scorecard initialization");
      } catch (err) {
        assert(err.message.indexOf("ERR_DUPLICATE_SCORECARD") !== -1, "Duplicate initialization check failed: " + err.message);
      }
    } catch (e) {
      assert(false, "Scorecard initialization failed: " + e.toString());
    }

    // 2. Test Score Detail Autosave & Constraints
    try {
      const details = [
        {
          scoreCriterionId: "CRIT_01",
          criterionCode: "ROBOT_SPEED",
          rawScore: 85.0,
          tenantId: tenantId
        }
      ];
      const sc = scAppSvc.saveDetailsDraft(scId, details, actorContext);
      assert(sc.scorecardStatus === "IN_PROGRESS", "Autosave failed to set status to IN_PROGRESS");

      // Verify detail record created
      const storedDetails = detailRepo.findByScorecard(scId, tenantId);
      assert(storedDetails.length === 1 && storedDetails[0].rawScore === 85.0, "Detail record failed to save correctly");
    } catch (e) {
      assert(false, "Score details autosave tests failed: " + e.toString());
    }

    // 3. Test Scorecard Submission & Criteria validations
    try {
      // Out of bounds raw score check:
      const detailsInvalid = [
        {
          scoreCriterionId: "CRIT_01",
          criterionCode: "ROBOT_SPEED",
          rawScore: 150.0, // Invalid! Max score is 100
          tenantId: tenantId
        }
      ];
      const scTempId = "SC_TEST_TEMP_02";
      const scTemp = scAppSvc.initializeScorecard({
        scorecardId: scTempId,
        registrationId: regId,
        judgeId: "JDG_TEST_02",
        scoreTemplateId: "TEMP_STAGE4_TEST",
        tenantId: tenantId
      }, actorContext);

      scAppSvc.saveDetailsDraft(scTempId, detailsInvalid, actorContext);
      try {
        scAppSvc.submitScorecard(scTempId, 2, actorContext);
        assert(false, "Allowed submission of out-of-bounds scores");
      } catch (err) {
        assert(err.message.indexOf("ERR_SCORE_OUT_OF_BOUNDS") !== -1, "Out of bounds score check failed");
      }

      // Successful submission check:
      const scLoaded = scRepo.findById(scId, tenantId);
      const submitted = scAppSvc.submitScorecard(scId, scLoaded.rowVersion, actorContext);
      assert(submitted.scorecardStatus === "SUBMITTED", "Submission status mismatch: " + submitted.scorecardStatus);
    } catch (e) {
      assert(false, "Submission tests failed: " + e.toString());
    }

    // 4. Test Multi-Judge Aggregation & Medal Classifications
    try {
      const summary = aggSvc.calculateFinalResult(regId, actorContext);
      assert(summary.averageScore === 85.0, "Summary average score calculation incorrect: " + summary.averageScore);
      assert(summary.medalTier === "GOLD", "Medal classification failed to award GOLD for 85 points: " + summary.medalTier);

      // Verify medal record created
      const storedMedals = medalRepo.getSheet();
      let foundMedal = false;
      if (storedMedals.getLastRow() > 1) {
        const data = storedMedals.getRange(2, 1, storedMedals.getLastRow() - 1, storedMedals.getLastColumn()).getValues();
        const headerMap = medalRepo.getHeaderMap(storedMedals);
        const regCol = headerMap["registrationId"] - 1;
        const tierCol = headerMap["medalTier"] - 1;
        data.forEach(row => {
          if (row[regCol] === regId && row[tierCol] === "GOLD") foundMedal = true;
        });
      }
      assert(foundMedal, "Medal record failed to be written to sheet");
    } catch (e) {
      assert(false, "Panel aggregation tests failed: " + e.toString());
    }

    // 5. Test Chief Judge Verification & Return Workflows
    try {
      const verified = verifySvc.verifyResult(regId, chiefContext);
      assert(verified.summaryStatus === "VERIFIED", "Verification failed to set status to VERIFIED");

      // Test Return for correction
      const returned = verifySvc.returnScorecard(scId, "ความถูกต้องคะแนนย่อยมีความขัดแย้ง", chiefContext);
      assert(returned.scorecardStatus === "IN_PROGRESS", "Return failed to revert status to IN_PROGRESS");
      assert(returned.returnReason === "ความถูกต้องคะแนนย่อยมีความขัดแย้ง", "Return failed to save reason");

      // Verify that return reason is required
      try {
        verifySvc.returnScorecard(scId, "", chiefContext);
        assert(false, "Allowed return without reason");
      } catch (err) {
        assert(err.message.indexOf("ERR_RETURN_REASON_REQUIRED") !== -1, "Return reason verification failed");
      }

      // Re-submit for locking tests
      const scLoaded = scRepo.findById(scId, tenantId);
      scAppSvc.submitScorecard(scId, scLoaded.rowVersion, actorContext);
      verifySvc.verifyResult(regId, chiefContext);
    } catch (e) {
      assert(false, "Verification & Return tests failed: " + e.toString());
    }

    // 6. Test Hard Lock & Unlock Workflows
    try {
      const locked = lockSvc.hardLockResult(regId, chiefContext);
      assert(locked.summaryStatus === "HARD_LOCKED", "Lock failed to transition to HARD_LOCKED");

      // Verify that score changes are rejected after hard locking
      try {
        scAppSvc.saveDetailsDraft(scId, [{ scoreCriterionId: "CRIT_01", rawScore: 90.0, tenantId: tenantId }], actorContext);
        assert(false, "Allowed edits after result hard locked");
      } catch (err) {
        assert(err.message.indexOf("ERR_MUTATION_BLOCKED") !== -1, "Hard lock mutation checks failed");
      }

      // Test Unlock
      const unlocked = lockSvc.unlockResult(regId, "แก้ไขเพิ่มเติมเอกสารประเมิน", chiefContext);
      assert(unlocked.summaryStatus === "VERIFIED", "Unlock failed to revert status to VERIFIED");

      // Verify that unlock reason is required
      try {
        lockSvc.unlockResult(regId, "", chiefContext);
        assert(false, "Allowed unlock without reason");
      } catch (err) {
        assert(err.message.indexOf("ERR_UNLOCK_REASON_REQUIRED") !== -1, "Unlock reason validation failed");
      }
    } catch (e) {
      assert(false, "Lock & Unlock tests failed: " + e.toString());
    }

    // 7. Test Appeal Submission
    try {
      const appeal = {
        appealId: "APP_TEST_01",
        registrationId: regId,
        competitionId: "COMP_STAGE4_TEST_01",
        reason: "ขอตรวจสอบคะแนนความคุ้มค่าหุ่นยนต์เนื่องจากความคาดเคลื่อนเวลา",
        tenantId: tenantId
      };
      const created = appealSvc.submitAppeal(appeal, actorContext);
      assert(created.appealStatus === "SUBMITTED", "Appeal status incorrect");
    } catch (e) {
      assert(false, "Appeal submission tests failed: " + e.toString());
    }

    return results;
  }
};
