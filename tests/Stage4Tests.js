/**
 * Competition Platform Engineering Standards (CPES)
 * Stage 4 Automated Competition Configuration & Engine Tests
 */

const CMPE_STAGE4_TESTS = {
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
    const actorContext = { userId: "TEST_USER_1", tenantId: tenantId, roles: ["SUPER_ADMIN"] };

    const compRepo = new CompetitionRepository();
    const roundRepo = new CompetitionRoundRepository();
    const catConfigRepo = new CompetitionCategoryConfigRepository();
    const ruleRepo = new CategoryRuleRepository();
    const scoreTempRepo = new ScoreTemplateRepository();
    const criteriaRepo = new ScoreCriterionRepository();
    const windowRepo = new RegistrationWindowRepository();
    const medalRepo = new MedalRuleRepository();

    const readinessSvc = new ConfigurationReadinessService(roundRepo, catConfigRepo, ruleRepo, windowRepo);
    const lifecycleSvc = new CompetitionLifecycleService(compRepo, readinessSvc);
    const appSvc = new CompetitionApplicationService(compRepo, roundRepo, catConfigRepo, ruleRepo, scoreTempRepo, criteriaRepo, windowRepo);

    Logger.log("--- Starting Stage 4 Competition Configuration & Engines Tests ---");

    // Clean old test competitions
    try {
      const cSheet = compRepo.getSheet();
      if (cSheet.getLastRow() > 1) {
        const data = cSheet.getRange(2, 1, cSheet.getLastRow() - 1, cSheet.getLastColumn()).getValues();
        const headerMap = compRepo.getHeaderMap(cSheet);
        const codeCol = headerMap["competitionCode"] - 1;
        for (let i = data.length - 1; i >= 0; i--) {
          if (data[i][codeCol].indexOf("STAGE4_TEST") !== -1 || data[i][codeCol].indexOf("CLONED_") === 0) {
            cSheet.deleteRow(i + 2);
          }
        }
      }
    } catch (e) {}

    // 1. Test Competition Creation and State Machine
    let compId = "COMP_STAGE4_TEST_01";
    try {
      const compData = {
        competitionId: compId,
        competitionCode: "STAGE4_TEST_01",
        nameTh: "การแข่งขันทดสอบขั้นที่ 4",
        nameEn: "Stage 4 Test Competition",
        competitionTypeId: "TYPE_ROBOTICS",
        startDate: "2026-08-01",
        endDate: "2026-08-05",
        status: "DRAFT",
        tenantId: tenantId
      };
      
      const created = appSvc.createCompetition(compData, actorContext);
      assert(created.status === "DRAFT", "New competition should default to DRAFT");

      // Verify invalid transition DRAFT -> REGISTRATION_OPEN (should reject!)
      try {
        lifecycleSvc.transitionStatus(compId, "REGISTRATION_OPEN", created.rowVersion, actorContext);
        assert(false, "Bypassed sequential lifecycle transitions rules");
      } catch (err) {
        assert(err.message.indexOf("ERR_INVALID_TRANSITION") !== -1, "Invalid state transition did not throw correct error code");
      }

      // Verify transition to CONFIGURED fails because configuration is incomplete (no rounds/categories)
      try {
        lifecycleSvc.transitionStatus(compId, "CONFIGURED", created.rowVersion, actorContext);
        assert(false, "Transitioned to CONFIGURED despite incomplete configuration readiness");
      } catch (err) {
        assert(err.message.indexOf("ERR_CONFIGURATION_INCOMPLETE") !== -1, "Incomplete configuration check failed to reject transition");
      }
    } catch (e) {
      assert(false, "Competition state machine test error: " + e.toString());
    }

    // 2. Setup Configuration Completeness
    try {
      // Add Round
      const round = new CompetitionRoundEntity({
        roundId: "RND_STAGE4_TEST",
        competitionId: compId,
        roundSequence: 1,
        nameTh: "รอบชิงชนะเลิศ",
        nameEn: "Final Round",
        status: "ACTIVE",
        tenantId: tenantId
      });
      roundRepo.create(round, actorContext);

      // Add Category Config
      const catConfig = new CompetitionCategoryConfigEntity({
        configId: "CONF_STAGE4_TEST",
        competitionId: compId,
        categoryId: "CAT_ROBOT_BASIC",
        educationLevelId: "LVL_JUNIOR_HIGH",
        scoreTemplateId: "TEMP_STAGE4_TEST",
        medalRuleId: "MEDAL_STAGE4_TEST",
        status: "ACTIVE",
        tenantId: tenantId
      });
      catConfigRepo.create(catConfig, actorContext);

      // Add Registration Window
      const window = new RegistrationWindowEntity({
        registrationWindowId: "WIN_STAGE4_TEST",
        competitionId: compId,
        openTimestamp: "2026-07-01T00:00:00Z",
        closeTimestamp: "2026-07-31T23:59:59Z",
        status: "ACTIVE",
        tenantId: tenantId
      });
      windowRepo.create(window, actorContext);

      // Verify transition from DRAFT -> CONFIGURED now passes!
      const activeComp = new CompetitionEntity(compRepo.findById(compId, tenantId));
      const transitioned = lifecycleSvc.transitionStatus(compId, "CONFIGURED", activeComp.rowVersion, actorContext);
      assert(transitioned.status === "CONFIGURED", "Ready configuration failed to transition to CONFIGURED");
    } catch (e) {
      assert(false, "Configuration completeness tests failed: " + e.toString());
    }

    // 3. Test Configuration Cloning
    try {
      const clone = appSvc.cloneCompetition(compId, "การแข่งขันโคลน", "Cloned Competition", actorContext);
      assert(clone.status === "DRAFT", "Cloned competition status must start as DRAFT");
      assert(clone.competitionCode.indexOf("CLONED_") === 0, "Cloned competition code should start with CLONED_");

      // Verify child rounds cloned
      const clonedRounds = roundRepo.findByCompetition(clone.competitionId);
      assert(clonedRounds.length === 1, "Child rounds were not cloned");
      assert(clonedRounds[0].nameTh === "รอบชิงชนะเลิศ", "Cloned round values mismatch");
    } catch (e) {
      assert(false, "Cloning test failed: " + e.toString());
    }

    // 4. Test Dynamic Rule Engine
    try {
      const rule = new CategoryRuleEntity({
        categoryRuleId: "RULE_TEST_01",
        competitionCategoryConfigId: "CONF_STAGE4_TEST",
        ruleCode: "ELIG_GRADE",
        ruleType: "GRADE_RANGE",
        priority: 10,
        conditionJson: JSON.stringify({ field: "grade", operator: "IN", value: [7, 8, 9] }),
        actionJson: JSON.stringify({ type: "REJECT" }),
        errorCode: "ERR_GRADE_OUT_OF_BOUNDS",
        errorMessageTh: "ระดับชั้นไม่ถูกต้อง",
        status: "ACTIVE",
        tenantId: tenantId
      });

      // Valid context (grade 8 is IN [7, 8, 9], wait, the action is REJECT when matched!)
      // Let's refine the test rule logic: if grade is NOT IN [7,8,9], then reject!
      const rule2 = new CategoryRuleEntity({
        categoryRuleId: "RULE_TEST_02",
        competitionCategoryConfigId: "CONF_STAGE4_TEST",
        ruleCode: "ELIG_GRADE_BOUND",
        ruleType: "GRADE_RANGE",
        priority: 5,
        conditionJson: JSON.stringify({ field: "grade", operator: "NOT_IN", value: [7, 8, 9] }),
        actionJson: JSON.stringify({ type: "REJECT" }),
        errorCode: "ERR_GRADE_OUT_OF_BOUNDS",
        errorMessageTh: "ระดับชั้นไม่ถูกต้อง",
        status: "ACTIVE",
        tenantId: tenantId
      });

      const resValid = DynamicRuleEngine.evaluateRules([rule2], { grade: 8 });
      assert(resValid.valid === true, "Valid student grade rejected by rule engine");

      const resInvalid = DynamicRuleEngine.evaluateRules([rule2], { grade: 6 });
      assert(resInvalid.valid === false, "Invalid student grade allowed by rule engine");
      assert(resInvalid.errors[0].errorCode === "ERR_GRADE_OUT_OF_BOUNDS", "Correct error code not returned");
    } catch (e) {
      assert(false, "Rule engine test failed: " + e.toString());
    }

    // 5. Test Score Calculation Engine
    try {
      const criteria = [
        new ScoreCriterionEntity({ criterionCode: "CRIT_DESIGN", weight: 1.0 }),
        new ScoreCriterionEntity({ criterionCode: "CRIT_RUN", weight: 2.0 })
      ];
      
      const values = {
        CRIT_DESIGN: 40.0,
        CRIT_RUN: 30.0
      };

      const score = ScoreCalculatorEngine.calculateScore(criteria, values, "WEIGHTED_SUM", 2);
      // WEIGHTED_SUM = (40 * 1.0 + 30 * 2.0) / (1.0 + 2.0) = 100 / 3 = 33.33
      assert(score === 33.33, "Weighted sum calculation failed: " + score);
    } catch (e) {
      assert(false, "Score calculation engine test failed: " + e.toString());
    }

    // 6. Test Medal Classification Engine
    try {
      const medalRule = new MedalRuleEntity({
        goldThreshold: 80.0,
        silverThreshold: 70.0,
        bronzeThreshold: 60.0
      });

      assert(medalRule.classifyScore(85.5) === "GOLD", "Gold threshold failed");
      assert(medalRule.classifyScore(72.0) === "SILVER", "Silver threshold failed");
      assert(medalRule.classifyScore(60.0) === "BRONZE", "Bronze threshold failed");
      assert(medalRule.classifyScore(58.0) === "PARTICIPATION", "Participation fallback failed");
    } catch (e) {
      assert(false, "Medal classification engine failed: " + e.toString());
    }

    // 7. Test Registration Windows Date Boundaries
    try {
      const window = new RegistrationWindowEntity({
        openTimestamp: "2026-07-01T00:00:00Z",
        closeTimestamp: "2026-07-31T23:59:59Z",
        status: "ACTIVE"
      });

      assert(window.isOpen("2026-07-15T12:00:00Z"), "Valid timestamp within window returned closed");
      assert(!window.isOpen("2026-06-30T23:59:59Z"), "Timestamp before window returned open");
      assert(!window.isOpen("2026-08-01T00:00:00Z"), "Timestamp after window returned open");
    } catch (e) {
      assert(false, "Registration window test failed: " + e.toString());
    }

    return results;
  }
};
