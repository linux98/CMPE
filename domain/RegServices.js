/**
 * Competition Platform Engineering Standards (CPES)
 * Stage 5 - Registration Application Services
 */

class RegistrationApplicationService {
  constructor(regRepo, memberRepo, coachRepo, subRepo, attachRepo, historyRepo) {
    this.regRepo = regRepo;
    this.memberRepo = memberRepo;
    this.coachRepo = coachRepo;
    this.subRepo = subRepo;
    this.attachRepo = attachRepo;
    this.historyRepo = historyRepo;
  }

  createRegistration(payload, actor) {
    const reg = new RegistrationEntity(payload);
    reg.registrationId = payload.registrationId || CMPE_UTILITIES.generateUuid();
    reg.registrationStatus = "DRAFT";
    reg.rowVersion = 1;
    
    // Auto-generate human readable registration number
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const sequenceLock = LockService.getScriptLock();
    sequenceLock.waitLock(10000);
    try {
      const props = PropertiesService.getScriptProperties();
      const key = `REG_SEQUENCE_${actor.tenantId}_${dateStr}`;
      const next = (parseInt(props.getProperty(key), 10) || 0) + 1;
      props.setProperty(key, String(next));
      reg.registrationNumber = `REG-${dateStr}-${String(next).padStart(5, "0")}`;
    } finally {
      sequenceLock.releaseLock();
    }
    
    this.regRepo.create(reg, actor);
    
    // Append creation history
    const hist = new RegistrationHistoryEntryEntity({
      registrationHistoryId: CMPE_UTILITIES.generateUuid(),
      registrationId: reg.registrationId,
      actionType: "CREATED",
      changeLogJson: JSON.stringify({ message: "Registration draft created successfully." }),
      tenantId: actor.tenantId
    });
    this.historyRepo.create(hist, actor);
    
    return reg;
  }

  addMember(payload, actor) {
    const member = new RegistrationMemberEntity(payload);
    member.registrationMemberId = payload.registrationMemberId || CMPE_UTILITIES.generateUuid();
    
    // Validate that registration is in DRAFT
    const regRow = this.regRepo.findById(member.registrationId, actor.tenantId);
    if (!regRow) throw new Error("ERR_REG_NOT_FOUND");
    if (regRow.registrationStatus !== "DRAFT") {
      throw new Error("ERR_MUTATION_BLOCKED: Members can only be added to DRAFT registrations.");
    }
    
    const created = this.memberRepo.create(member, actor);
    
    // Log history
    const hist = new RegistrationHistoryEntryEntity({
      registrationHistoryId: CMPE_UTILITIES.generateUuid(),
      registrationId: member.registrationId,
      actionType: "MEMBER_ADDED",
      changeLogJson: JSON.stringify({ memberId: member.registrationMemberId, name: `${member.firstNameTh} ${member.lastNameTh}` }),
      tenantId: actor.tenantId
    });
    this.historyRepo.create(hist, actor);
    
    return created;
  }

  addCoach(payload, actor) {
    const coach = new CoachEntity(payload);
    coach.coachId = payload.coachId || CMPE_UTILITIES.generateUuid();
    
    const regRow = this.regRepo.findById(coach.registrationId, actor.tenantId);
    if (!regRow) throw new Error("ERR_REG_NOT_FOUND");
    if (regRow.registrationStatus !== "DRAFT") {
      throw new Error("ERR_MUTATION_BLOCKED");
    }
    
    const created = this.coachRepo.create(coach, actor);
    
    // Log history
    const hist = new RegistrationHistoryEntryEntity({
      registrationHistoryId: CMPE_UTILITIES.generateUuid(),
      registrationId: coach.registrationId,
      actionType: "COACH_ADDED",
      changeLogJson: JSON.stringify({ coachId: coach.coachId, name: `${coach.firstNameTh} ${coach.lastNameTh}` }),
      tenantId: actor.tenantId
    });
    this.historyRepo.create(hist, actor);
    
    return created;
  }

  addSubstitute(payload, actor) {
    const sub = new SubstituteEntity(payload);
    sub.substituteId = payload.substituteId || CMPE_UTILITIES.generateUuid();
    
    const regRow = this.regRepo.findById(sub.registrationId, actor.tenantId);
    if (!regRow) throw new Error("ERR_REG_NOT_FOUND");
    if (regRow.registrationStatus !== "DRAFT") {
      throw new Error("ERR_MUTATION_BLOCKED");
    }
    
    const created = this.subRepo.create(sub, actor);
    return created;
  }

  addAttachment(payload, actor) {
    const attach = new RegistrationAttachmentEntity(payload);
    attach.attachmentId = payload.attachmentId || CMPE_UTILITIES.generateUuid();
    
    const regRow = this.regRepo.findById(attach.registrationId, actor.tenantId);
    if (!regRow) throw new Error("ERR_REG_NOT_FOUND");
    if (regRow.registrationStatus !== "DRAFT") {
      throw new Error("ERR_MUTATION_BLOCKED");
    }
    
    const created = this.attachRepo.create(attach, actor);
    return created;
  }
}

class RegistrationSubmissionService {
  constructor(regRepo, memberRepo, coachRepo, subRepo, attachRepo, historyRepo, quotaSvc, duplicateSvc, ruleRepo, categoryConfigRepo) {
    this.regRepo = regRepo;
    this.memberRepo = memberRepo;
    this.coachRepo = coachRepo;
    this.subRepo = subRepo;
    this.attachRepo = attachRepo;
    this.historyRepo = historyRepo;
    this.quotaSvc = quotaSvc;
    this.duplicateSvc = duplicateSvc;
    this.ruleRepo = ruleRepo;
    this.categoryConfigRepo = categoryConfigRepo;
  }

  submitRegistration(registrationId, expectedRowVersion, actor) {
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(15000);
    } catch (e) {
      throw new Error("Lock contention on registration submission");
    }

    try {
      // 1. Authoritative Load
      const regRow = this.regRepo.findById(registrationId, actor.tenantId);
      if (!regRow) throw new Error("ERR_REG_NOT_FOUND");
      
      const reg = new RegistrationEntity(regRow);
      if (reg.registrationStatus !== "DRAFT") {
        throw new Error("ERR_STATE_VIOLATION: Registration must be in DRAFT state to submit.");
      }

      // Load child members
      const members = this.memberRepo.findByRegistration(registrationId, actor.tenantId);
      
      // 2. Perform duplicate participant checks
      const duplicates = this.duplicateSvc.detectDuplicates(members, reg.competitionId, actor.tenantId);
      if (duplicates.hasDuplicates) {
        throw new Error("ERR_DUPLICATE_CONTESTANT: One or more contestants are already registered in this competition.");
      }

      // 3. Quota validations
      const quota = this.quotaSvc.getQuotaStatus(reg.schoolId, reg.competitionCategoryConfigId, actor.tenantId);
      if (quota.consumed >= quota.limit) {
        throw new Error("ERR_QUOTA_EXCEEDED: School has exceeded its allowed quota of team registrations.");
      }

      // 4. Evaluate Dynamic Category Rules (Stage 4 Rules engine)
      const rules = this.ruleRepo.findByConfig(reg.competitionCategoryConfigId);
      // Run evaluation on all members
      for (let i = 0; i < members.length; i++) {
        const m = members[i];
        const ruleEval = DynamicRuleEngine.evaluateRules(rules, { grade: parseInt(m.gradeLevel) });
        if (!ruleEval.valid) {
          throw new Error("ERR_RULE_VIOLATION: Contestant fails category eligibility check: " + ruleEval.errors[0].messageTh);
        }
      }

      // 5. Transition to SUBMITTED
      reg.registrationStatus = "SUBMITTED";
      reg.submissionTimestamp = new Date().toISOString();
      reg.submittedBy = actor.userId;
      
      this.regRepo.update(reg, expectedRowVersion, actor);

      // Save history
      const hist = new RegistrationHistoryEntryEntity({
        registrationHistoryId: CMPE_UTILITIES.generateUuid(),
        registrationId: registrationId,
        actionType: "SUBMITTED",
        changeLogJson: JSON.stringify({ message: "Registration submitted successfully." }),
        tenantId: actor.tenantId
      });
      this.historyRepo.create(hist, actor);

      return reg;
    } finally {
      lock.releaseLock();
    }
  }
}

class RegistrationReviewService {
  constructor(regRepo, historyRepo) {
    this.regRepo = regRepo;
    this.historyRepo = historyRepo;
  }

  approveRegistration(registrationId, expectedRowVersion, actor) {
    const regRow = this.regRepo.findById(registrationId, actor.tenantId);
    if (!regRow) throw new Error("ERR_REG_NOT_FOUND");
    
    const reg = new RegistrationEntity(regRow);
    if (reg.registrationStatus !== "SUBMITTED") {
      throw new Error("ERR_STATE_VIOLATION: Only SUBMITTED registrations can be approved.");
    }
    
    reg.registrationStatus = "APPROVED";
    reg.approvalTimestamp = new Date().toISOString();
    reg.approvedBy = actor.userId;
    
    this.regRepo.update(reg, expectedRowVersion, actor);
    
    const hist = new RegistrationHistoryEntryEntity({
      registrationHistoryId: CMPE_UTILITIES.generateUuid(),
      registrationId: registrationId,
      actionType: "APPROVED",
      changeLogJson: JSON.stringify({ approvedBy: actor.userId }),
      tenantId: actor.tenantId
    });
    this.historyRepo.create(hist, actor);
    return reg;
  }

  rejectRegistration(registrationId, reason, expectedRowVersion, actor) {
    if (!reason) throw new Error("ERR_REJECTION_REASON_REQUIRED");
    
    const regRow = this.regRepo.findById(registrationId, actor.tenantId);
    if (!regRow) throw new Error("ERR_REG_NOT_FOUND");
    
    const reg = new RegistrationEntity(regRow);
    if (reg.registrationStatus !== "SUBMITTED") {
      throw new Error("ERR_STATE_VIOLATION");
    }
    
    reg.registrationStatus = "REJECTED";
    reg.rejectionTimestamp = new Date().toISOString();
    reg.rejectedBy = actor.userId;
    reg.rejectionReason = reason;
    
    this.regRepo.update(reg, expectedRowVersion, actor);
    
    const hist = new RegistrationHistoryEntryEntity({
      registrationHistoryId: CMPE_UTILITIES.generateUuid(),
      registrationId: registrationId,
      actionType: "REJECTED",
      changeLogJson: JSON.stringify({ reason }),
      tenantId: actor.tenantId
    });
    this.historyRepo.create(hist, actor);
    return reg;
  }
}

class DuplicateDetectionService {
  constructor(memberRepo, regRepo) {
    this.memberRepo = memberRepo;
    this.regRepo = regRepo;
  }

  detectDuplicates(newMembers, competitionId, tenantId) {
    const sheet = this.memberRepo.getSheet();
    if (sheet.getLastRow() <= 1) return { hasDuplicates: false, duplicateNames: [] };
    
    const headerMap = this.memberRepo.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    
    const fNameCol = headerMap["firstNameTh"] - 1;
    const lNameCol = headerMap["lastNameTh"] - 1;
    const dobCol = headerMap["dateOfBirth"] - 1;
    const regIdCol = headerMap["registrationId"] - 1;
    const tenantCol = headerMap["tenantId"] - 1;
    const statusCol = headerMap["recordStatus"] - 1;
    
    // Load all active registration IDs for this competition to cross check boundaries
    const regSheet = this.regRepo.getSheet();
    const regHeaderMap = this.regRepo.getHeaderMap(regSheet);
    const regData = regSheet.getRange(2, 1, regSheet.getLastRow() - 1, regSheet.getLastColumn()).getValues();
    const activeRegIds = new Set();
    
    regData.forEach(row => {
      if (row[regHeaderMap["competitionId"] - 1] === competitionId && 
          row[regHeaderMap["recordStatus"] - 1] !== "DELETED" && 
          row[regHeaderMap["registrationStatus"] - 1] !== "REJECTED" && 
          row[regHeaderMap["registrationStatus"] - 1] !== "WITHDRAWN") {
        activeRegIds.add(row[regHeaderMap["registrationId"] - 1]);
      }
    });

    const excludeRegId = newMembers[0]?.registrationId || "";
    const duplicateNames = [];
    newMembers.forEach(member => {
      const mEntity = new RegistrationMemberEntity(member);
      const targetFingerprint = mEntity.getDuplicateFingerprint();
      
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (row[tenantCol] === tenantId && row[statusCol] !== "DELETED") {
          // Verify linked registration belongs to active registrations for this competition
          if (row[regIdCol] !== excludeRegId && activeRegIds.has(row[regIdCol])) {
            const m = new RegistrationMemberEntity({
              firstNameTh: row[fNameCol],
              lastNameTh: row[lNameCol],
              dateOfBirth: row[dobCol]
            });
            if (m.getDuplicateFingerprint() === targetFingerprint) {
              duplicateNames.push(`${mEntity.firstNameTh} ${mEntity.lastNameTh}`);
              break;
            }
          }
        }
      }
    });

    return {
      hasDuplicates: duplicateNames.length > 0,
      duplicateNames: duplicateNames
    };
  }
}

class QuotaConsumptionService {
  constructor(regRepo, categoryConfigRepo, quotaRuleRepo) {
    this.regRepo = regRepo;
    this.categoryConfigRepo = categoryConfigRepo || null;
    this.quotaRuleRepo = quotaRuleRepo || null;
  }

  getQuotaStatus(schoolId, configId, tenantId) {
    const sheet = this.regRepo.getSheet();
    if (sheet.getLastRow() <= 1) return { limit: 1, consumed: 0 };
    
    const headerMap = this.regRepo.getHeaderMap(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    
    const schoolCol = headerMap["schoolId"] - 1;
    const configCol = headerMap["competitionCategoryConfigId"] - 1;
    const statusCol = headerMap["registrationStatus"] - 1;
    const recStatusCol = headerMap["recordStatus"] - 1;
    const tenantCol = headerMap["tenantId"] - 1;
    
    let consumed = 0;
    data.forEach(row => {
      // Quota is consumed if registration is in SUBMITTED or APPROVED states
      if (row[schoolCol] === schoolId && 
          row[configCol] === configId && 
          row[tenantCol] === tenantId && 
          row[recStatusCol] !== "DELETED" && 
          (row[statusCol] === "SUBMITTED" || row[statusCol] === "APPROVED")) {
        consumed++;
      }
    });

    let limit = 1;
    if (this.categoryConfigRepo && this.quotaRuleRepo) {
      const config = this.categoryConfigRepo.findById(configId, tenantId);
      if (config && config.quotaRuleId) {
        const quotaRule = this.quotaRuleRepo.findById(config.quotaRuleId, tenantId);
        const configuredLimit = quotaRule ? parseInt(quotaRule.maxRegistrations, 10) : NaN;
        if (Number.isFinite(configuredLimit) && configuredLimit > 0) {
          limit = configuredLimit;
        }
      }
    }

    return { limit, consumed };
  }
}
