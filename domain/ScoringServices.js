/**
 * Competition Platform Engineering Standards (CPES)
 * Stage 7 - Scoring & Evaluation Services
 */

class ScorecardApplicationService {
  constructor(scorecardRepo, detailRepo) {
    this.scorecardRepo = scorecardRepo;
    this.detailRepo = detailRepo;
  }

  initializeScorecard(payload, actor) {
    const existing = this.scorecardRepo.findByRegistration(payload.registrationId, actor.tenantId);
    const judgeExists = existing.some(sc => sc.judgeId === payload.judgeId);
    if (judgeExists) {
      throw new Error("ERR_DUPLICATE_SCORECARD: A scorecard for this judge and registration already exists.");
    }

    const sc = new ScorecardEntity(payload);
    sc.scorecardId = payload.scorecardId || CMPE_UTILITIES.generateUuid();
    sc.scorecardStatus = "DRAFT";
    sc.rowVersion = 1;

    return this.scorecardRepo.create(sc, actor);
  }

  saveDetailsDraft(scorecardId, detailsList, actor) {
    const sc = this.scorecardRepo.findById(scorecardId, actor.tenantId);
    if (!sc) throw new Error("ERR_SCORECARD_NOT_FOUND");
    if (sc.scorecardStatus !== "DRAFT" && sc.scorecardStatus !== "IN_PROGRESS") {
      throw new Error("ERR_MUTATION_BLOCKED: Scorecard is already submitted or locked.");
    }

    const existingDetails = this.detailRepo.findByScorecard(scorecardId, actor.tenantId);

    // Upsert by criterion so repeatedly saving a draft does not duplicate rows.
    detailsList.forEach(detail => {
      const existing = existingDetails.find(item =>
        (detail.scoreDetailId && item.scoreDetailId === detail.scoreDetailId) ||
        (detail.scoreCriterionId && item.scoreCriterionId === detail.scoreCriterionId) ||
        (detail.criterionCode && item.criterionCode === detail.criterionCode)
      );
      const d = new ScoreDetailEntity(existing ? Object.assign({}, existing, detail) : detail);
      d.scoreDetailId = existing ? existing.scoreDetailId :
        (detail.scoreDetailId || CMPE_UTILITIES.generateUuid());
      d.scorecardId = scorecardId;
      d.tenantId = actor.tenantId;
      d.enteredTimestamp = new Date().toISOString();
      d.enteredBy = actor.userId;
      if (existing) {
        this.detailRepo.update(d, existing.rowVersion, actor);
      } else {
        this.detailRepo.create(d, actor);
      }
    });

    // Update status to IN_PROGRESS
    sc.scorecardStatus = "IN_PROGRESS";
    this.scorecardRepo.update(sc, undefined, actor);

    return sc;
  }

  submitScorecard(scorecardId, rowVersion, actor) {
    const sc = this.scorecardRepo.findById(scorecardId, actor.tenantId);
    if (!sc) throw new Error("ERR_SCORECARD_NOT_FOUND");
    if (sc.rowVersion !== parseInt(rowVersion)) {
      throw new Error("ERR_CONCURRENCY_409: Version mismatch.");
    }

    // Load details to ensure required entries exist
    const details = this.detailRepo.findByScorecard(scorecardId, actor.tenantId);
    if (details.length === 0) {
      throw new Error("ERR_INCOMPLETE_SCORECARD: No scores entered.");
    }

    // Enforce bound limit checks (e.g. score must be between 0 and 100)
    details.forEach(d => {
      if (d.rawScore < 0 || d.rawScore > 100) {
        throw new Error("ERR_SCORE_OUT_OF_BOUNDS: Raw score must be between 0 and 100.");
      }
    });

    sc.scorecardStatus = "SUBMITTED";
    sc.submittedTimestamp = new Date().toISOString();
    return this.scorecardRepo.update(sc, rowVersion, actor);
  }
}

class ScorePanelAggregationService {
  constructor(scorecardRepo, detailRepo, summaryRepo, medalRepo) {
    this.scorecardRepo = scorecardRepo;
    this.detailRepo = detailRepo;
    this.summaryRepo = summaryRepo;
    this.medalRepo = medalRepo;
  }

  calculateFinalResult(registrationId, actor) {
    const scorecards = this.scorecardRepo.findByRegistration(registrationId, actor.tenantId);
    const submitted = scorecards.filter(sc => sc.scorecardStatus === "SUBMITTED" || sc.scorecardStatus === "VERIFIED");
    if (submitted.length === 0) {
      throw new Error("ERR_INCOMPLETE_PANEL: No submitted scorecards found.");
    }

    // Calculate each judge's total from persisted score details. Prefer the
    // weighted score, then normalized score, and finally the raw score.
    const panelScores = submitted.map(sc => {
      const details = this.detailRepo.findByScorecard(sc.scorecardId, actor.tenantId);
      if (details.length === 0) {
        throw new Error("ERR_INCOMPLETE_PANEL: Submitted scorecard has no score details.");
      }
      return details.reduce((sum, detail) => {
        const candidate = detail.weightedScore !== "" && detail.weightedScore !== undefined
          ? detail.weightedScore
          : (detail.normalizedScore !== "" && detail.normalizedScore !== undefined
            ? detail.normalizedScore
            : detail.rawScore);
        const value = Number(candidate);
        if (!Number.isFinite(value)) {
          throw new Error("ERR_INVALID_SCORE_VALUE: A score detail is not numeric.");
        }
        return sum + value;
      }, 0);
    });

    const average = Number(
      (panelScores.reduce((sum, value) => sum + value, 0) / panelScores.length)
        .toFixed(2)
    );
    const variance = Number(
      (panelScores.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) /
        panelScores.length).toFixed(2)
    );

    // Classification of Medal Tier
    let medal = "PARTICIPATION";
    if (average >= 80.00) medal = "GOLD";
    else if (average >= 70.00) medal = "SILVER";
    else if (average >= 60.00) medal = "BRONZE";

    const summary = new ScoreSummaryEntity({
      tenantId: actor.tenantId,
      competitionId: scorecards[0].competitionId,
      competitionRoundId: scorecards[0].competitionRoundId,
      competitionCategoryConfigId: scorecards[0].competitionCategoryConfigId,
      registrationId: registrationId,
      averageScore: average,
      scoreVariance: variance,
      medalTier: medal,
      summaryStatus: "PENDING"
    });

    const existingSummary = this.summaryRepo.findByRegistration(registrationId, actor.tenantId);
    if (existingSummary) {
      summary.scoreSummaryId = existingSummary.scoreSummaryId;
      summary.rowVersion = existingSummary.rowVersion;
      this.summaryRepo.update(summary, existingSummary.rowVersion, actor);
    } else {
      summary.scoreSummaryId = CMPE_UTILITIES.generateUuid();
      this.summaryRepo.create(summary, actor);
    }

    // Upsert the medal so recalculation does not create duplicate awards.
    const existingMedal = this.medalRepo.findByRegistration(registrationId, actor.tenantId);
    const medalObj = new MedalEntity({
      tenantId: actor.tenantId,
      medalId: existingMedal ? existingMedal.medalId : CMPE_UTILITIES.generateUuid(),
      registrationId: registrationId,
      medalTier: medal,
      awardedTimestamp: new Date().toISOString(),
      resultVersion: summary.rowVersion || 1,
      rowVersion: existingMedal ? existingMedal.rowVersion : 1
    });
    if (existingMedal) {
      this.medalRepo.update(medalObj, existingMedal.rowVersion, actor);
    } else {
      this.medalRepo.create(medalObj, actor);
    }

    return summary;
  }
}

class ChiefJudgeVerificationService {
  constructor(scorecardRepo, summaryRepo) {
    this.scorecardRepo = scorecardRepo;
    this.summaryRepo = summaryRepo;
  }

  verifyResult(registrationId, actor) {
    const summary = this.summaryRepo.findByRegistration(registrationId, actor.tenantId);
    if (!summary) throw new Error("ERR_SUMMARY_NOT_FOUND");

    summary.summaryStatus = "VERIFIED";
    this.summaryRepo.update(summary, summary.rowVersion, actor);

    // Update all submitted scorecards to VERIFIED
    const scorecards = this.scorecardRepo.findByRegistration(registrationId, actor.tenantId);
    scorecards.forEach(sc => {
      if (sc.scorecardStatus === "SUBMITTED") {
        sc.scorecardStatus = "VERIFIED";
        this.scorecardRepo.update(sc, sc.rowVersion, actor);
      }
    });

    return summary;
  }

  returnScorecard(scorecardId, reason, actor) {
    if (!reason) throw new Error("ERR_RETURN_REASON_REQUIRED");
    
    const sc = this.scorecardRepo.findById(scorecardId, actor.tenantId);
    if (!sc) throw new Error("ERR_SCORECARD_NOT_FOUND");
    
    sc.scorecardStatus = "IN_PROGRESS";
    sc.returnReason = reason;
    sc.returnedBy = actor.userId;
    sc.returnedTimestamp = new Date().toISOString();
    
    return this.scorecardRepo.update(sc, sc.rowVersion, actor);
  }
}

class ResultLockApplicationService {
  constructor(summaryRepo, historyRepo) {
    this.summaryRepo = summaryRepo;
    this.historyRepo = historyRepo;
  }

  hardLockResult(registrationId, actor) {
    const summary = this.summaryRepo.findByRegistration(registrationId, actor.tenantId);
    if (!summary) throw new Error("ERR_SUMMARY_NOT_FOUND");
    if (summary.summaryStatus !== "VERIFIED") {
      throw new Error("ERR_NOT_VERIFIED: Result summary must be verified before hard locking.");
    }

    summary.summaryStatus = "HARD_LOCKED";
    this.summaryRepo.update(summary, summary.rowVersion, actor);

    // Log to score_lock_history
    const history = new ScoreLockHistoryEntryEntity({
      tenantId: actor.tenantId,
      scoreLockHistoryId: CMPE_UTILITIES.generateUuid(),
      competitionId: summary.competitionId,
      competitionRoundId: summary.competitionRoundId,
      competitionCategoryConfigId: summary.competitionCategoryConfigId,
      registrationId: registrationId,
      scoreSummaryId: summary.scoreSummaryId,
      action: "HARD_LOCKED",
      previousState: "VERIFIED",
      newState: "HARD_LOCKED",
      actorUserId: actor.userId,
      reason: "Locked by Chief Judge",
      timestamp: new Date().toISOString()
    });
    this.historyRepo.create(history, actor);

    return summary;
  }

  unlockResult(registrationId, reason, actor) {
    if (!reason) throw new Error("ERR_UNLOCK_REASON_REQUIRED");

    const summary = this.summaryRepo.findByRegistration(registrationId, actor.tenantId);
    if (!summary) throw new Error("ERR_SUMMARY_NOT_FOUND");

    summary.summaryStatus = "VERIFIED";
    this.summaryRepo.update(summary, summary.rowVersion, actor);

    const history = new ScoreLockHistoryEntryEntity({
      tenantId: actor.tenantId,
      scoreLockHistoryId: CMPE_UTILITIES.generateUuid(),
      competitionId: summary.competitionId,
      competitionRoundId: summary.competitionRoundId,
      competitionCategoryConfigId: summary.competitionCategoryConfigId,
      registrationId: registrationId,
      scoreSummaryId: summary.scoreSummaryId,
      action: "UNLOCKED",
      previousState: "HARD_LOCKED",
      newState: "VERIFIED",
      actorUserId: actor.userId,
      reason: reason,
      timestamp: new Date().toISOString()
    });
    this.historyRepo.create(history, actor);

    return summary;
  }
}

class AppealApplicationService {
  constructor(appealRepo) {
    this.appealRepo = appealRepo;
  }

  submitAppeal(payload, actor) {
    const appeal = new AppealEntity(payload);
    appeal.tenantId = actor.tenantId;
    appeal.appealId = payload.appealId || CMPE_UTILITIES.generateUuid();
    appeal.appealStatus = "SUBMITTED";
    appeal.rowVersion = 1;

    return this.appealRepo.create(appeal, actor);
  }
}
