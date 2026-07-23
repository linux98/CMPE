/**
 * Competition Platform Engineering Standards (CPES)
 * Stage 10 - Analytics & Reporting Domain Entities & Value Objects
 */

class DashboardCacheEntity {
  constructor(data) {
    this.dashboardCacheId = data.dashboardCacheId || "";
    this.tenantId = data.tenantId || "";
    this.academicYearId = data.academicYearId || "";
    this.competitionId = data.competitionId || "";
    this.dashboardCode = data.dashboardCode || ""; // HOME_PUBLIC, AREA_ADMIN_OVERVIEW, etc.
    this.audienceScope = data.audienceScope || "GUEST_VIEWER"; // GUEST_VIEWER, SCHOOL_ADMIN, etc.
    this.filterKey = data.filterKey || "";
    this.metricPayloadJson = data.metricPayloadJson || "{}";
    this.sourceVersion = parseInt(data.sourceVersion) || 1;
    this.cacheVersion = parseInt(data.cacheVersion) || 1;
    this.generatedTimestamp = data.generatedTimestamp || "";
    this.expiresTimestamp = data.expiresTimestamp || "";
    this.freshnessStatus = data.freshnessStatus || "CURRENT"; // CURRENT, STALE, REBUILDING, EXPIRED
    this.generationStatus = data.generationStatus || "COMPLETED"; // COMPLETED, FAILED
    this.generatedByJobId = data.generatedByJobId || "";
    this.checksum = data.checksum || "";

    // Metadata
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class LeaderboardCacheEntity {
  constructor(data) {
    this.leaderboardCacheId = data.leaderboardCacheId || "";
    this.tenantId = data.tenantId || "";
    this.academicYearId = data.academicYearId || "";
    this.competitionId = data.competitionId || "";
    this.competitionCategoryConfigId = data.competitionCategoryConfigId || "";
    this.competitionRoundId = data.competitionRoundId || "";
    this.leaderboardType = data.leaderboardType || "SCHOOL_MEDAL_STANDINGS";
    this.resultVersion = data.resultVersion || "v1";
    this.rankingPolicyVersion = data.rankingPolicyVersion || "1.0";
    this.payloadJson = data.payloadJson || "[]";
    this.generatedTimestamp = data.generatedTimestamp || "";
    this.publishedTimestamp = data.publishedTimestamp || "";
    this.freshnessStatus = data.freshnessStatus || "CURRENT"; // CURRENT, STALE
    this.checksum = data.checksum || "";

    // Metadata
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class StatisticEntity {
  constructor(data) {
    this.statisticId = data.statisticId || "";
    this.tenantId = data.tenantId || "";
    this.academicYearId = data.academicYearId || "";
    this.competitionId = data.competitionId || "";
    this.categoryId = data.categoryId || "";
    this.metricCode = data.metricCode || "";
    this.dimensionCode = data.dimensionCode || "";
    this.dimensionValue = data.dimensionValue || "";
    this.periodType = data.periodType || "DAILY";
    this.periodStart = data.periodStart || "";
    this.periodEnd = data.periodEnd || "";
    this.numericValue = parseFloat(data.numericValue) || 0;
    this.textValue = data.textValue || "";
    this.payloadJson = data.payloadJson || "{}";
    this.sourceVersion = parseInt(data.sourceVersion) || 1;
    this.generatedTimestamp = data.generatedTimestamp || "";
    this.checksum = data.checksum || "";

    // Metadata
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class ReportEntity {
  constructor(data) {
    this.reportId = data.reportId || "";
    this.tenantId = data.tenantId || "";
    this.reportCode = data.reportCode || "";
    this.reportName = data.reportName || "";
    this.requestedBy = data.requestedBy || "";
    this.requestTimestamp = data.requestTimestamp || "";
    this.filterJson = data.filterJson || "{}";
    this.sortJson = data.sortJson || "{}";
    this.format = data.format || "CSV"; // CSV, PDF, HTML, XLSX
    this.reportStatus = data.reportStatus || "REQUESTED"; // REQUESTED, QUEUED, GENERATING, GENERATED, AVAILABLE, FAILED
    this.sourceVersion = parseInt(data.sourceVersion) || 1;
    this.generatedTimestamp = data.generatedTimestamp || "";
    this.expiresTimestamp = data.expiresTimestamp || "";
    this.outputFileId = data.outputFileId || "";
    this.outputFileName = data.outputFileName || "";
    this.outputMimeType = data.outputMimeType || "text/csv";
    this.rowCount = parseInt(data.rowCount) || 0;
    this.pageCount = parseInt(data.pageCount) || 1;
    this.checksum = data.checksum || "";
    this.failureCode = data.failureCode || "";
    this.failureMessage = data.failureMessage || "";
    this.generatedByJobId = data.generatedByJobId || "";

    // Metadata
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}
