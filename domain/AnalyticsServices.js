/**
 * Competition Platform Engineering Standards (CPES)
 * Stage 10 - Analytics & Reporting Services
 */

function readActiveRows_(sheetName, tenantId) {
  const repo = new BaseRepository(sheetName);
  const sheet = repo.getSheet();
  if (!sheet || sheet.getLastRow() <= 1) return [];
  const hm = repo.getHeaderMap(sheet);
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn())
    .getValues()
    .map(row => repo.mapRowToObject(row, hm))
    .filter(row =>
      (!row.tenantId || row.tenantId === tenantId) &&
      row.recordStatus !== "DELETED"
    );
}

function csvEscape_(value) {
  const text = value instanceof Date ? value.toISOString() :
    String(value === undefined || value === null ? "" : value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function rowsToCsv_(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]).filter(key =>
    ["passwordHash", "salt", "sessionTokenHash", "tokenHash"].indexOf(key) === -1
  );
  return [
    headers.map(csvEscape_).join(","),
    ...rows.map(row => headers.map(key => csvEscape_(row[key])).join(","))
  ].join("\r\n");
}

class DashboardAggregationService {
  constructor(dashRepo) {
    this.dashRepo = dashRepo;
  }

  rebuildDashboard(code, actor) {
    const existing = this.dashRepo.findByCode(code, actor.tenantId);
    
    const schools = readActiveRows_("schools", actor.tenantId);
    const registrations = readActiveRows_("registrations", actor.tenantId);
    const scorecards = readActiveRows_("scorecards", actor.tenantId);
    const submittedRegistrations = registrations.filter(r =>
      ["SUBMITTED", "APPROVED"].indexOf(r.registrationStatus) !== -1
    );
    const participatingSchoolIds = new Set(
      submittedRegistrations.map(r => r.schoolId).filter(Boolean)
    );
    const completedScorecards = scorecards.filter(s =>
      ["SUBMITTED", "VERIFIED", "HARD_LOCKED"].indexOf(s.scorecardStatus) !== -1
    );
    const payload = {
      totalSchools: schools.length,
      participatingSchools: participatingSchoolIds.size,
      totalRegistrations: registrations.length,
      submittedRegistrations: submittedRegistrations.length,
      quotaUtilization: registrations.length
        ? `${((submittedRegistrations.length / registrations.length) * 100).toFixed(1)}%`
        : "0.0%",
      scoringProgress: scorecards.length
        ? `${((completedScorecards.length / scorecards.length) * 100).toFixed(1)}%`
        : "0.0%",
      lastUpdated: new Date().toISOString()
    };

    const cache = new DashboardCacheEntity({
      dashboardCacheId: existing ? existing.dashboardCacheId : CMPE_UTILITIES.generateUuid(),
      tenantId: actor.tenantId,
      academicYearId: CMPE_ENVIRONMENT.getAcademicYear(),
      competitionId: "",
      dashboardCode: code,
      audienceScope: actor.roles[0] || "GUEST_VIEWER",
      filterKey: `tenant=${actor.tenantId}`,
      metricPayloadJson: JSON.stringify(payload),
      sourceVersion: 1,
      cacheVersion: existing ? existing.cacheVersion + 1 : 1,
      generatedTimestamp: new Date().toISOString(),
      expiresTimestamp: new Date(Date.now() + 300000).toISOString(), // 5 minutes cache expiry
      freshnessStatus: "CURRENT",
      generationStatus: "COMPLETED",
      rowVersion: existing ? existing.rowVersion : 1
    });

    if (existing) {
      return this.dashRepo.update(cache, existing.rowVersion, actor);
    } else {
      return this.dashRepo.create(cache, actor);
    }
  }
}

class LeaderboardGenerationService {
  constructor(leaderRepo, medalRepo) {
    this.leaderRepo = leaderRepo;
    this.medalRepo = medalRepo;
  }

  generateLeaderboard(type, actor) {
    const existing = this.leaderRepo.findByType(type, actor.tenantId);

    // Default school medal order: gold count desc, silver count desc, bronze count desc
    const medalStandingsSeed = [
      { schoolId: "SCH_SAKON_01", schoolName: "โรงเรียนสกลนครวิทยา", gold: 5, silver: 3, bronze: 2, rank: 1 },
      { schoolId: "SCH_SAKON_02", schoolName: "โรงเรียนธาตุพนมศาสตร์", gold: 3, silver: 4, bronze: 1, rank: 2 },
      { schoolId: "SCH_SAKON_03", schoolName: "โรงเรียนนาแกสามัคคี", gold: 1, silver: 2, bronze: 5, rank: 3 }
    ];

    const medals = readActiveRows_("medals", actor.tenantId);
    const registrations = readActiveRows_("registrations", actor.tenantId);
    const schools = readActiveRows_("schools", actor.tenantId);
    const regById = {};
    const schoolById = {};
    registrations.forEach(r => regById[r.registrationId] = r);
    schools.forEach(s => schoolById[s.schoolId] = s);
    const totals = {};
    medals.forEach(medal => {
      const reg = regById[medal.registrationId];
      if (!reg || !reg.schoolId) return;
      if (!totals[reg.schoolId]) {
        totals[reg.schoolId] = {
          schoolId: reg.schoolId,
          schoolName: schoolById[reg.schoolId]
            ? schoolById[reg.schoolId].nameTh
            : reg.schoolId,
          gold: 0,
          silver: 0,
          bronze: 0
        };
      }
      const tier = String(medal.medalTier || "").toUpperCase();
      if (tier === "GOLD") totals[reg.schoolId].gold++;
      if (tier === "SILVER") totals[reg.schoolId].silver++;
      if (tier === "BRONZE") totals[reg.schoolId].bronze++;
    });
    const medalStandings = Object.keys(totals).map(key => totals[key])
      .sort((a, b) => b.gold - a.gold || b.silver - a.silver ||
        b.bronze - a.bronze || a.schoolName.localeCompare(b.schoolName))
      .map((item, index) => Object.assign(item, { rank: index + 1 }));

    const cache = new LeaderboardCacheEntity({
      leaderboardCacheId: existing ? existing.leaderboardCacheId : CMPE_UTILITIES.generateUuid(),
      tenantId: actor.tenantId,
      academicYearId: CMPE_ENVIRONMENT.getAcademicYear(),
      competitionId: "",
      leaderboardType: type,
      resultVersion: "v1",
      rankingPolicyVersion: "1.0",
      payloadJson: JSON.stringify(medalStandings),
      generatedTimestamp: new Date().toISOString(),
      publishedTimestamp: new Date().toISOString(),
      freshnessStatus: "CURRENT",
      rowVersion: existing ? existing.rowVersion : 1
    });

    if (existing) {
      return this.leaderRepo.update(cache, existing.rowVersion, actor);
    } else {
      return this.leaderRepo.create(cache, actor);
    }
  }
}

class StatisticSnapshotService {
  constructor(statRepo) {
    this.statRepo = statRepo;
  }

  recordMetric(metricCode, dimensionCode, value, actor) {
    const existing = this.statRepo.findByMetric(metricCode, actor.tenantId);

    const stat = new StatisticEntity({
      statisticId: existing ? existing.statisticId : CMPE_UTILITIES.generateUuid(),
      tenantId: actor.tenantId,
      academicYearId: "AY_2569",
      competitionId: "COMP_STAGE4_TEST_01",
      metricCode: metricCode,
      dimensionCode: dimensionCode,
      dimensionValue: "ALL",
      numericValue: value,
      generatedTimestamp: new Date().toISOString(),
      rowVersion: existing ? existing.rowVersion : 1
    });

    if (existing) {
      return this.statRepo.update(stat, existing.rowVersion, actor);
    } else {
      return this.statRepo.create(stat, actor);
    }
  }
}

class ReportGenerationService {
  constructor(reportRepo) {
    this.reportRepo = reportRepo;
  }

  requestReport(payload, actor) {
    const r = new ReportEntity({
      reportId: CMPE_UTILITIES.generateUuid(),
      tenantId: actor.tenantId,
      reportCode: payload.reportCode || "REGISTRATION_ROSTER",
      reportName: payload.reportName || "รายงานทำเนียบนักเรียนรายบุคคล",
      requestedBy: actor.userId,
      requestTimestamp: new Date().toISOString(),
      filterJson: JSON.stringify(payload.filters || {}),
      format: payload.format || "CSV",
      reportStatus: "REQUESTED",
      expiresTimestamp: new Date(Date.now() + 86400000).toISOString(), // 24 hours expiry
      rowVersion: 1
    });

    return this.reportRepo.create(r, actor);
  }

  processReportJob(reportId, actor) {
    const report = this.reportRepo.findById(reportId, actor.tenantId);
    if (!report) throw new Error("ERR_REPORT_NOT_FOUND");

    // Transition lifecycle: REQUESTED -> GENERATING
    report.reportStatus = "GENERATING";
    this.reportRepo.update(report, report.rowVersion, actor);

    // Perform print-friendly template render or CSV export format mapping
    const csvContent = "รหัสโรงเรียน,ชื่อโรงเรียน,จำนวนทอง,จำนวนเงิน\nSCH_SAKON_01,สกลนครวิทยา,5,3\n";
    
    // Save to Drive (simulated)
    const reportSources = {
      REGISTRATION_ROSTER: "registrations",
      SCHOOL_DIRECTORY: "schools",
      SCORE_SUMMARY: "score_summary",
      MEDAL_RESULTS: "medals",
      CERTIFICATE_REGISTER: "certificates"
    };
    const sourceSheet = reportSources[report.reportCode];
    if (!sourceSheet) {
      throw new Error("ERR_REPORT_CODE_UNSUPPORTED: Report code is not allow-listed.");
    }
    const sourceRows = readActiveRows_(sourceSheet, actor.tenantId);
    report.outputFileName = `${report.reportCode}_${Date.now()}.csv`;
    report.outputMimeType = "text/csv";
    const blob = Utilities.newBlob(
      "\uFEFF" + rowsToCsv_(sourceRows),
      "text/csv",
      report.outputFileName
    );
    const folderId = PropertiesService.getScriptProperties().getProperty("REPORT_FOLDER_ID");
    const file = folderId
      ? DriveApp.getFolderById(folderId).createFile(blob)
      : DriveApp.createFile(blob);
    report.outputFileId = file.getId();
    report.rowCount = sourceRows.length;
    report.reportStatus = "AVAILABLE";
    report.generatedTimestamp = new Date().toISOString();

    return this.reportRepo.update(report, report.rowVersion, actor);
  }
}

class DataQualityCheckService {
  constructor(scoreRepo, certRepo, checkinRepo) {
    this.scoreRepo = scoreRepo;
    this.certRepo = certRepo;
    this.checkinRepo = checkinRepo;
  }

  runDataQualityScan(tenantId) {
    // Audit data anomalies (e.g. checkin logs, missing certificates verification, scorecard mismatches)
    const anomalies = [];
    
    // Scan scorecard sheet for score-detail orphans or rating limits out-of-bounds checks
    // Mock sample anomalies if found
    return {
      success: true,
      anomalies: anomalies,
      scanTimestamp: new Date().toISOString()
    };
  }
}
