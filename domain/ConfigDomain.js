/**
 * Competition Platform Engineering Standards (CPES)
 * Stage 4 - Configuration Domain Entities & Dynamic Rule Engines
 */

class CompetitionEntity {
  constructor(data) {
    this.competitionId = data.competitionId || "";
    this.tenantId = data.tenantId || "";
    this.academicYearId = data.academicYearId || "";
    this.competitionCode = data.competitionCode || "";
    this.nameTh = data.nameTh || "";
    this.nameEn = data.nameEn || "";
    this.competitionTypeId = data.competitionTypeId || "";
    this.startDate = data.startDate || "";
    this.endDate = data.endDate || "";
    this.timezone = data.timezone || "Asia/Bangkok";
    this.status = data.status || "DRAFT"; // DRAFT, CONFIGURED, REGISTRATION_OPEN, REGISTRATION_CLOSED, SCHEDULING
    
    // Metadata
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }

  /**
   * Enforces the valid state machine transitions
   */
  canTransitionTo(nextState) {
    const states = [
      "DRAFT", "CONFIGURED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", 
      "SCHEDULING", "SCORING_OPEN", "SCORING_CLOSED", "RESULTS_LOCKED", 
      "CERTIFICATES_ACTIVE", "ARCHIVED"
    ];
    
    const currentIdx = states.indexOf(this.status);
    const nextIdx = states.indexOf(nextState);
    
    if (currentIdx === -1 || nextIdx === -1) return false;
    
    // Standard sequential transitions
    if (nextIdx === currentIdx + 1) return true;
    
    // Allow archiving from anywhere except already archived
    if (nextState === "ARCHIVED" && this.status !== "ARCHIVED") return true;
    
    return false;
  }
}

class CompetitionRoundEntity {
  constructor(data) {
    this.competitionRoundId = data.competitionRoundId || data.roundId || "";
    this.competitionId = data.competitionId || "";
    this.roundSequence = parseInt(data.roundSequence) || 1;
    this.nameTh = data.nameTh || "";
    this.nameEn = data.nameEn || "";
    this.status = data.status || "ACTIVE";
    
    // Metadata
    this.tenantId = data.tenantId || "";
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class CompetitionCategoryConfigEntity {
  constructor(data) {
    this.competitionCategoryConfigId =
      data.competitionCategoryConfigId || data.configId || "";
    this.competitionId = data.competitionId || "";
    this.categoryId = data.categoryId || "";
    this.educationLevelId = data.educationLevelId || "";
    this.scoreTemplateId = data.scoreTemplateId || "";
    this.medalRuleId = data.medalRuleId || "";
    this.certificateTemplateId = data.certificateTemplateId || "";
    this.quotaRuleId = data.quotaRuleId || "";
    this.registrationWindowId = data.registrationWindowId || "";
    this.status = data.status || "ACTIVE";
    this.displayOrder = parseInt(data.displayOrder) || 1;
    
    // Overrides
    this.participantMinOverride = data.participantMinOverride || "";
    this.participantMaxOverride = data.participantMaxOverride || "";
    this.coachMinOverride = data.coachMinOverride || "";
    this.coachMaxOverride = data.coachMaxOverride || "";
    
    // Metadata
    this.tenantId = data.tenantId || "";
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class CategoryRuleEntity {
  constructor(data) {
    this.categoryRuleId = data.categoryRuleId || "";
    this.competitionCategoryConfigId = data.competitionCategoryConfigId || "";
    this.ruleCode = data.ruleCode || "";
    this.ruleType = data.ruleType || "ELIGIBILITY"; // ELIGIBILITY, GRADE_RANGE, PARTICIPANT_MIN_MAX
    this.priority = parseInt(data.priority) || 10;
    
    // Condition / Action Configurations
    this.conditionJson = data.conditionJson || "{}";
    this.actionJson = data.actionJson || "{}";
    this.errorCode = data.errorCode || "ERR_RULE_VIOLATION";
    this.errorMessageTh = data.errorMessageTh || "";
    this.errorMessageEn = data.errorMessageEn || "";
    this.status = data.status || "ACTIVE";
    
    // Metadata
    this.tenantId = data.tenantId || "";
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class ScoreTemplateEntity {
  constructor(data) {
    this.scoreTemplateId = data.scoreTemplateId || "";
    this.name = data.name || "";
    this.aggregationMethod = data.aggregationMethod || "SUM"; // SUM, AVERAGE, WEIGHTED_SUM
    this.decimalPrecision = parseInt(data.decimalPrecision) || 2;
    this.status = data.status || "ACTIVE";
    
    // Metadata
    this.tenantId = data.tenantId || "";
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class ScoreCriterionEntity {
  constructor(data) {
    this.scoreCriterionId = data.scoreCriterionId || data.criterionId || "";
    this.scoreTemplateId = data.scoreTemplateId || "";
    this.criterionCode = data.criterionCode || "";
    this.nameTh = data.nameTh || "";
    this.nameEn = data.nameEn || "";
    this.criterionType = data.criterionType || "NUMERIC"; // NUMERIC, RUBRIC, PASS_FAIL
    this.minimumScore = parseFloat(data.minimumScore) || 0;
    this.maximumScore = parseFloat(data.maximumScore) || 100;
    this.weight = parseFloat(data.weight) || 1.0;
    this.displayOrder = parseInt(data.displayOrder) || 1;
    this.status = data.status || "ACTIVE";
    
    // Metadata
    this.tenantId = data.tenantId || "";
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class QuotaRuleEntity {
  constructor(data) {
    this.quotaRuleId = data.quotaRuleId || "";
    this.name = data.name || "";
    this.scopeType = data.scopeType || "SCHOOL"; // SCHOOL, DISTRICT, TENANT
    this.maxRegistrations = parseInt(data.maxRegistrations) || 1;
    this.status = data.status || "ACTIVE";
    
    // Metadata
    this.tenantId = data.tenantId || "";
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class ScheduleTemplateEntity {
  constructor(data) {
    this.scheduleTemplateId = data.scheduleTemplateId || "";
    this.name = data.name || "";
    this.slotDurationMinutes = parseInt(data.slotDurationMinutes) || 30;
    this.breakDurationMinutes = parseInt(data.breakDurationMinutes) || 0;
    this.status = data.status || "ACTIVE";
    
    // Metadata
    this.tenantId = data.tenantId || "";
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class CertificateTemplateEntity {
  constructor(data) {
    this.certificateTemplateId = data.certificateTemplateId || "";
    this.name = data.name || "";
    this.slidesFileId = data.slidesFileId || "";
    this.placeholderMapJson = data.placeholderMapJson || "{}";
    this.status = data.status || "ACTIVE";
    
    // Metadata
    this.tenantId = data.tenantId || "";
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class MedalRuleEntity {
  constructor(data) {
    this.medalRuleId = data.medalRuleId || "";
    this.name = data.name || "";
    this.goldThreshold = parseFloat(data.goldThreshold) || 80.0;
    this.silverThreshold = parseFloat(data.silverThreshold) || 70.0;
    this.bronzeThreshold = parseFloat(data.bronzeThreshold) || 60.0;
    this.status = data.status || "ACTIVE";
    
    // Metadata
    this.tenantId = data.tenantId || "";
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }

  /**
   * Helper to classify a raw score into standard tiers
   */
  classifyScore(score) {
    const val = parseFloat(score);
    if (isNaN(val)) return "PARTICIPATION";
    if (val >= this.goldThreshold) return "GOLD";
    if (val >= this.silverThreshold) return "SILVER";
    if (val >= this.bronzeThreshold) return "BRONZE";
    return "PARTICIPATION";
  }
}

class RegistrationWindowEntity {
  constructor(data) {
    this.registrationWindowId = data.registrationWindowId || "";
    this.competitionId = data.competitionId || "";
    this.openTimestamp = data.openTimestamp || "";
    this.closeTimestamp = data.closeTimestamp || "";
    this.status = data.status || "ACTIVE";
    
    // Metadata
    this.tenantId = data.tenantId || "";
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }

  isOpen(currentTimeIso) {
    if (this.status !== "ACTIVE") return false;
    const now = new Date(currentTimeIso).getTime();
    const open = new Date(this.openTimestamp).getTime();
    const close = new Date(this.closeTimestamp).getTime();
    return now >= open && now <= close;
  }
}

/**
 * ==================================================
 * DYNAMIC RULE ENGINE - DOMAIN SERVICE
 * ==================================================
 */
class DynamicRuleEngine {
  /**
   * Evaluates a set of category rules against participant input context
   */
  static evaluateRules(rules, context) {
    const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);
    const results = {
      valid: true,
      messages: [],
      errors: []
    };

    for (let i = 0; i < sortedRules.length; i++) {
      const rule = sortedRules[i];
      if (rule.status !== "ACTIVE" || rule.recordStatus === "DELETED") continue;
      
      const condition = JSON.parse(rule.conditionJson || "{}");
      const isMatched = this.evaluateCondition(condition, context);
      
      if (isMatched) {
        // Trigger action
        const action = JSON.parse(rule.actionJson || "{}");
        if (action.type === "REJECT" || action.type === "BLOCK") {
          results.valid = false;
          results.errors.push({
            ruleCode: rule.ruleCode,
            errorCode: rule.errorCode,
            messageTh: rule.errorMessageTh,
            messageEn: rule.errorMessageEn
          });
          break; // Stop evaluation on blocking error
        } else {
          results.messages.push({
            ruleCode: rule.ruleCode,
            type: action.type || "WARNING",
            messageTh: rule.errorMessageTh,
            messageEn: rule.errorMessageEn
          });
        }
      }
    }

    return results;
  }

  static evaluateCondition(cond, context) {
    // Simple schema matcher (e.g. { field: "grade", operator: "IN", value: [1, 2, 3] })
    if (!cond.field || !cond.operator) return false;
    
    const val = context[cond.field];
    if (val === undefined) return false;
    
    switch (cond.operator) {
      case "EQUALS":
      case "==":
        return val === cond.value;
      case "NOT_EQUALS":
      case "!=":
        return val !== cond.value;
      case "GREATER_THAN":
      case ">":
        return val > cond.value;
      case "LESS_THAN":
      case "<":
        return val < cond.value;
      case "IN":
        return Array.isArray(cond.value) && cond.value.includes(val);
      case "NOT_IN":
        return Array.isArray(cond.value) && !cond.value.includes(val);
      default:
        return false;
    }
  }
}

/**
 * ==================================================
 * SCORE CALCULATION ENGINE - DOMAIN SERVICE
 * ==================================================
 */
class ScoreCalculatorEngine {
  /**
   * Aggregates judge scores based on template criteria mappings
   */
  static calculateScore(criteria, values, aggregationMethod, decimalPrecision = 2) {
    // Filter criteria keys
    let total = 0;
    let count = 0;
    let weightSum = 0;
    
    criteria.forEach(crit => {
      const val = parseFloat(values[crit.criterionCode]);
      if (!isNaN(val)) {
        if (aggregationMethod === "SUM") {
          total += val;
        } else if (aggregationMethod === "AVERAGE") {
          total += val;
          count++;
        } else if (aggregationMethod === "WEIGHTED_SUM" || aggregationMethod === "WEIGHTED_AVERAGE") {
          total += val * crit.weight;
          weightSum += crit.weight;
        }
      }
    });
    
    let result = 0;
    if (aggregationMethod === "AVERAGE" && count > 0) {
      result = total / count;
    } else if ((aggregationMethod === "WEIGHTED_SUM" || aggregationMethod === "WEIGHTED_AVERAGE") && weightSum > 0) {
      result = total / weightSum;
    } else {
      result = total;
    }
    
    return parseFloat(result.toFixed(decimalPrecision));
  }
}
