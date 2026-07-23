/**
 * Competition Platform Engineering Standards (CPES)
 * Stage 4 - Configuration Application Services
 */

class CompetitionApplicationService {
  constructor(compRepo, roundRepo, categoryConfigRepo, ruleRepo, scoreTempRepo, criteriaRepo, windowRepo) {
    this.compRepo = compRepo;
    this.roundRepo = roundRepo;
    this.categoryConfigRepo = categoryConfigRepo;
    this.ruleRepo = ruleRepo;
    this.scoreTempRepo = scoreTempRepo;
    this.criteriaRepo = criteriaRepo;
    this.windowRepo = windowRepo;
  }

  createCompetition(payload, actor) {
    const comp = new CompetitionEntity(payload);
    comp.competitionId = payload.competitionId || CMPE_UTILITIES.generateUuid();
    comp.status = "DRAFT";
    return this.compRepo.create(comp, actor);
  }

  updateCompetition(payload, expectedRowVersion, actor) {
    const comp = new CompetitionEntity(payload);
    return this.compRepo.update(comp, expectedRowVersion, actor);
  }

  /**
   * Clones a competition configurations without transactional data
   */
  cloneCompetition(competitionId, newNameTh, newNameEn, actor) {
    const original = this.compRepo.findById(competitionId, actor.tenantId);
    if (!original) throw new Error("ERR_COMP_NOT_FOUND");
    
    const cloneCompId = CMPE_UTILITIES.generateUuid();
    const cloneCode = "CLONED_" + original.competitionCode + "_" + Date.now();
    
    const cloneComp = new CompetitionEntity({
      ...original,
      competitionId: cloneCompId,
      competitionCode: cloneCode,
      nameTh: newNameTh,
      nameEn: newNameEn,
      status: "DRAFT",
      rowVersion: 1
    });
    
    // Save new competition
    this.compRepo.create(cloneComp, actor);
    
    // Clone Rounds
    const rounds = this.roundRepo.findByCompetition(competitionId);
    rounds.forEach(r => {
      const cloneRound = new CompetitionRoundEntity({
        ...r,
        roundId: CMPE_UTILITIES.generateUuid(),
        competitionId: cloneCompId,
        rowVersion: 1
      });
      this.roundRepo.create(cloneRound, actor);
    });
    
    // Clone Category Configs
    const configs = this.categoryConfigRepo.findByCompetition(competitionId);
    configs.forEach(c => {
      const cloneConfigId = CMPE_UTILITIES.generateUuid();
      const cloneConfig = new CompetitionCategoryConfigEntity({
        ...c,
        configId: cloneConfigId,
        competitionId: cloneCompId,
        rowVersion: 1
      });
      this.categoryConfigRepo.create(cloneConfig, actor);
      
      // Clone Category Rules linked to this config
      const rules = this.ruleRepo.findByConfig(c.configId);
      rules.forEach(rule => {
        const cloneRule = new CategoryRuleEntity({
          ...rule,
          categoryRuleId: CMPE_UTILITIES.generateUuid(),
          competitionCategoryConfigId: cloneConfigId,
          rowVersion: 1
        });
        this.ruleRepo.create(cloneRule, actor);
      });
    });

    // Clone Registration Windows
    const windows = this.windowRepo.findByCompetition(competitionId);
    windows.forEach(w => {
      const cloneWindow = new RegistrationWindowEntity({
        ...w,
        registrationWindowId: CMPE_UTILITIES.generateUuid(),
        competitionId: cloneCompId,
        rowVersion: 1
      });
      this.windowRepo.create(cloneWindow, actor);
    });
    
    return cloneComp;
  }
}

class CompetitionLifecycleService {
  constructor(compRepo, readinessSvc) {
    this.compRepo = compRepo;
    this.readinessSvc = readinessSvc;
  }

  transitionStatus(competitionId, nextState, expectedRowVersion, actor) {
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
    } catch (e) {
      throw new Error("Lock contention on competition lifecycle transition");
    }
    
    try {
      const row = this.compRepo.findById(competitionId, actor.tenantId);
      if (!row) throw new Error("ERR_COMP_NOT_FOUND");
      
      const comp = new CompetitionEntity(row);
      
      if (!comp.canTransitionTo(nextState)) {
        throw new Error(`ERR_INVALID_TRANSITION: Cannot transition competition state from ${comp.status} to ${nextState}`);
      }
      
      // If transitioning from DRAFT to CONFIGURED, check readiness completeness!
      if (nextState === "CONFIGURED") {
        const readiness = this.readinessSvc.checkReadiness(competitionId, actor);
        if (!readiness.ready) {
          throw new Error("ERR_CONFIGURATION_INCOMPLETE: " + readiness.errors.join("; "));
        }
      }
      
      comp.status = nextState;
      return this.compRepo.update(comp, expectedRowVersion, actor);
    } finally {
      lock.releaseLock();
    }
  }
}

class ConfigurationReadinessService {
  constructor(roundRepo, categoryConfigRepo, ruleRepo, windowRepo) {
    this.roundRepo = roundRepo;
    this.categoryConfigRepo = categoryConfigRepo;
    this.ruleRepo = ruleRepo;
    this.windowRepo = windowRepo;
  }

  checkReadiness(competitionId, actor) {
    const errors = [];
    
    // Check Rounds: must have at least 1 active round
    const rounds = this.roundRepo.findByCompetition(competitionId);
    const activeRounds = rounds.filter(r => r.status === "ACTIVE" && r.recordStatus !== "DELETED");
    if (activeRounds.length === 0) {
      errors.push("At least one active competition round is required.");
    }
    
    // Check Category Configs: must have at least 1 active category configuration
    const configs = this.categoryConfigRepo.findByCompetition(competitionId);
    const activeConfigs = configs.filter(c => c.status === "ACTIVE" && c.recordStatus !== "DELETED");
    if (activeConfigs.length === 0) {
      errors.push("At least one annual category configuration must be assigned.");
    }
    
    // Verify each active category config has score template & medal rule assigned
    activeConfigs.forEach(c => {
      if (!c.scoreTemplateId) {
        errors.push(`Category ${c.categoryId} configuration is missing scoreTemplateId.`);
      }
      if (!c.medalRuleId) {
        errors.push(`Category ${c.categoryId} configuration is missing medalRuleId.`);
      }
    });

    // Check Registration Windows: must have at least 1 active registration window
    const windows = this.windowRepo.findByCompetition(competitionId);
    const activeWindows = windows.filter(w => w.status === "ACTIVE" && w.recordStatus !== "DELETED");
    if (activeWindows.length === 0) {
      errors.push("At least one active registration window must be defined.");
    }
    
    return {
      ready: errors.length === 0,
      errors: errors
    };
  }
}

class DynamicRuleApplicationService {
  constructor(ruleRepo) {
    this.ruleRepo = ruleRepo;
  }

  createRule(payload, actor) {
    const rule = new CategoryRuleEntity(payload);
    rule.categoryRuleId = payload.categoryRuleId || CMPE_UTILITIES.generateUuid();
    return this.ruleRepo.create(rule, actor);
  }

  previewRuleEvaluation(rulesJson, context) {
    const rules = JSON.parse(rulesJson).map(r => new CategoryRuleEntity(r));
    return DynamicRuleEngine.evaluateRules(rules, context);
  }
}

class ScoreTemplateApplicationService {
  constructor(tempRepo, criteriaRepo) {
    this.tempRepo = tempRepo;
    this.criteriaRepo = criteriaRepo;
  }

  createTemplate(payload, actor) {
    const temp = new ScoreTemplateEntity(payload);
    temp.scoreTemplateId = payload.scoreTemplateId || CMPE_UTILITIES.generateUuid();
    return this.tempRepo.create(temp, actor);
  }

  addCriterion(payload, actor) {
    const crit = new ScoreCriterionEntity(payload);
    crit.criterionId = payload.criterionId || CMPE_UTILITIES.generateUuid();
    return this.criteriaRepo.create(crit, actor);
  }

  previewCalculation(criteriaJson, values, aggregationMethod, decimalPrecision = 2) {
    const criteria = JSON.parse(criteriaJson).map(c => new ScoreCriterionEntity(c));
    const score = ScoreCalculatorEngine.calculateScore(criteria, values, aggregationMethod, decimalPrecision);
    return { calculatedScore: score };
  }
}

class QuotaRuleApplicationService {
  constructor(quotaRepo) {
    this.quotaRepo = quotaRepo;
  }

  createQuotaRule(payload, actor) {
    const rule = new QuotaRuleEntity(payload);
    rule.quotaRuleId = payload.quotaRuleId || CMPE_UTILITIES.generateUuid();
    return this.quotaRepo.create(rule, actor);
  }
}

class MedalRuleApplicationService {
  constructor(medalRepo) {
    this.medalRepo = medalRepo;
  }

  createMedalRule(payload, actor) {
    const rule = new MedalRuleEntity(payload);
    rule.medalRuleId = payload.medalRuleId || CMPE_UTILITIES.generateUuid();
    return this.medalRepo.create(rule, actor);
  }
}

class RegistrationWindowService {
  constructor(windowRepo) {
    this.windowRepo = windowRepo;
  }

  createWindow(payload, actor) {
    const window = new RegistrationWindowEntity(payload);
    window.registrationWindowId = payload.registrationWindowId || CMPE_UTILITIES.generateUuid();
    
    if (new Date(window.closeTimestamp) <= new Date(window.openTimestamp)) {
      throw new Error("ERR_DATETIME_INVALID: Close timestamp must be later than open timestamp.");
    }
    
    return this.windowRepo.create(window, actor);
  }
}
