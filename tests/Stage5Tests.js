/**
 * Competition Platform Engineering Standards (CPES)
 * Stage 5 Automated Registration Aggregate & Workflow Tests
 */

const CMPE_STAGE5_TESTS = {
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
    const actorContext = { userId: "SCHOOL_USER_9", tenantId: tenantId, schoolId: "SCH_SAKON_01", roles: ["SCHOOL_REGISTRAR"] };
    const adminContext = { userId: "ADMIN_USER_1", tenantId: tenantId, roles: ["AREA_ADMIN"] };

    const regRepo = new RegistrationRepository();
    const memberRepo = new RegistrationMemberRepository();
    const coachRepo = new CoachRepository();
    const subRepo = new SubstituteRepository();
    const attachRepo = new RegistrationAttachmentRepository();
    const historyRepo = new RegistrationHistoryRepository();
    const ruleRepo = new CategoryRuleRepository();
    
    const quotaSvc = new QuotaConsumptionService(regRepo);
    const duplicateSvc = new DuplicateDetectionService(memberRepo, regRepo);
    const appSvc = new RegistrationApplicationService(regRepo, memberRepo, coachRepo, subRepo, attachRepo, historyRepo);
    const submissionSvc = new RegistrationSubmissionService(
      regRepo, memberRepo, coachRepo, subRepo, attachRepo, historyRepo,
      quotaSvc, duplicateSvc, ruleRepo, new CompetitionCategoryConfigRepository()
    );
    const reviewSvc = new RegistrationReviewService(regRepo, historyRepo);

    Logger.log("--- Starting Stage 5 Registration Aggregate & Workflow Tests ---");

    // Clean old test registrations
    try {
      const rSheet = regRepo.getSheet();
      if (rSheet.getLastRow() > 1) {
        const data = rSheet.getRange(2, 1, rSheet.getLastRow() - 1, rSheet.getLastColumn()).getValues();
        const headerMap = regRepo.getHeaderMap(rSheet);
        const codeCol = headerMap["registrationNumber"] - 1;
        for (let i = data.length - 1; i >= 0; i--) {
          if (data[i][codeCol] && data[i][codeCol].indexOf("REG-") === 0) {
            rSheet.deleteRow(i + 2);
          }
        }
      }
    } catch (e) {}

    // 1. Test Draft Creation & Human Readable Numbers
    let regId = "";
    let regNum = "";
    try {
      const regData = {
        competitionId: "COMP_STAGE4_TEST_01",
        competitionCategoryConfigId: "CONF_STAGE4_TEST",
        schoolId: "SCH_SAKON_01",
        tenantId: tenantId
      };
      
      const draft = appSvc.createRegistration(regData, actorContext);
      regId = draft.registrationId;
      regNum = draft.registrationNumber;

      assert(draft.registrationStatus === "DRAFT", "New registration must default to DRAFT");
      assert(draft.registrationNumber.startsWith("REG-"), "Registration number must have REG- prefix");
      
      // Verify history logged
      const hist = historyRepo.findByRegistration(regId);
      assert(hist.length === 1, "Creation history entry missing");
      assert(hist[0].actionType === "CREATED", "History action type mismatch");
    } catch (e) {
      assert(false, "Draft creation test failed: " + e.toString());
    }

    // 2. Test Contestant & Coach Assignment inside Draft
    try {
      const mData = {
        registrationId: regId,
        firstNameTh: "สมชาย",
        lastNameTh: "ใจดี",
        dateOfBirth: "2012-05-10",
        gradeLevel: "8", // Grade 8 (Junior High)
        tenantId: tenantId
      };
      const member = appSvc.addMember(mData, actorContext);
      assert(member.firstNameTh === "สมชาย", "Member name mismatch");

      const cData = {
        registrationId: regId,
        firstNameTh: "ครูวิชัย",
        lastNameTh: "เรียนดี",
        isLeadCoach: true,
        tenantId: tenantId
      };
      const coach = appSvc.addCoach(cData, actorContext);
      assert(coach.isLeadCoach === true, "Lead coach assignment mismatch");

      // Verify child records query
      const members = memberRepo.findByRegistration(regId);
      assert(members.length === 1, "Failed to retrieve registered members");
    } catch (e) {
      assert(false, "Contestant/Coach assignment test error: " + e.toString());
    }

    // 3. Test Duplicate Contestant Checks
    try {
      const dupMember = new RegistrationMemberEntity({
        firstNameTh: "สมชาย",
        lastNameTh: "ใจดี",
        dateOfBirth: "2012-05-10",
        tenantId: tenantId
      });
      
      // Since this member is already added to regId, checking it against regId would flag duplicates if it matched other active registrations.
      // Let's verify fingerprint logic:
      assert(dupMember.getDuplicateFingerprint() === "สมชาย_ใจดี_2012-05-10", "Duplicate key fingerprint formatting mismatch");
    } catch (e) {
      assert(false, "Duplicate checks test error: " + e.toString());
    }

    // 4. Test Quota Validations
    try {
      const quota = quotaSvc.getQuotaStatus("SCH_SAKON_01", "CONF_STAGE4_TEST", tenantId);
      // Since we haven't submitted or approved yet, consumed quota must be 0
      assert(quota.consumed === 0, "Quota consumed count should be 0 for draft registrations");
      assert(quota.limit === 1, "Default school category quota limit should be 1");
    } catch (e) {
      assert(false, "Quota validations test error: " + e.toString());
    }

    // 5. Test Submission (validates rules, duplicates, quota, and state updates)
    try {
      // Setup dynamic rule to allow grade 8 (so it passes eligibility rule)
      const rule = new CategoryRuleEntity({
        categoryRuleId: "RULE_REG_TEST",
        competitionCategoryConfigId: "CONF_STAGE4_TEST",
        ruleCode: "ELIG_GRADE",
        ruleType: "GRADE_RANGE",
        priority: 10,
        conditionJson: JSON.stringify({ field: "grade", operator: "NOT_IN", value: [7, 8, 9] }),
        actionJson: JSON.stringify({ type: "REJECT" }),
        status: "ACTIVE",
        tenantId: tenantId
      });
      ruleRepo.create(rule, actorContext);

      // Perform submission
      const activeReg = new RegistrationEntity(regRepo.findById(regId, tenantId));
      const submitted = submissionSvc.submitRegistration(regId, activeReg.rowVersion, actorContext);
      assert(submitted.registrationStatus === "SUBMITTED", "Registration status was not transitioned to SUBMITTED");

      // Verify quota is now marked as consumed (since it is SUBMITTED)
      const newQuota = quotaSvc.getQuotaStatus("SCH_SAKON_01", "CONF_STAGE4_TEST", tenantId);
      assert(newQuota.consumed === 1, "Submitted registration did not consume quota");

      // Verify that adding members to SUBMITTED state is blocked!
      try {
        appSvc.addMember({ registrationId: regId, firstNameTh: "สมอุดม", lastNameTh: "ใจดี" }, actorContext);
        assert(false, "Bypassed DRAFT state constraint while adding member");
      } catch (err) {
        assert(err.message.indexOf("ERR_MUTATION_BLOCKED") !== -1, "Member addition into non-draft state did not throw correct error code");
      }
    } catch (e) {
      assert(false, "Submission workflow test error: " + e.toString());
    }

    // 6. Test Administrative Approval Review
    try {
      const activeReg = new RegistrationEntity(regRepo.findById(regId, tenantId));
      const approved = reviewSvc.approveRegistration(regId, activeReg.rowVersion, adminContext);
      assert(approved.registrationStatus === "APPROVED", "Failed to transition to APPROVED");
      
      const newQuota = quotaSvc.getQuotaStatus("SCH_SAKON_01", "CONF_STAGE4_TEST", tenantId);
      assert(newQuota.consumed === 1, "Approved registration did not retain consumed quota");
    } catch (e) {
      assert(false, "Review approval test error: " + e.toString());
    }

    return results;
  }
};
