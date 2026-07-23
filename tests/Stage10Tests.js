/**
 * Competition Platform Engineering Standards (CPES)
 * Stage 10 - Analytics & Reporting Tests
 */

const CMPE_STAGE10_TESTS = {
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

    const dashRepo = new DashboardCacheRepository();
    const leaderRepo = new LeaderboardCacheRepository();
    const statRepo = new StatisticRepository();
    const reportRepo = new ReportRepository();

    const dashSvc = new DashboardAggregationService(dashRepo);
    const leaderSvc = new LeaderboardGenerationService(leaderRepo, new MedalRepository());
    const statSvc = new StatisticSnapshotService(statRepo);
    const reportSvc = new ReportGenerationService(reportRepo);
    const dqSvc = new DataQualityCheckService(new ScorecardRepository(), new CertificateRepository(), new CheckInRepository());

    Logger.log("--- Starting Stage 10 Analytics & Reporting Tests ---");

    // Clean old test records
    try {
      const dSheet = dashRepo.getSheet();
      if (dSheet.getLastRow() > 1) {
        const data = dSheet.getRange(2, 1, dSheet.getLastRow() - 1, dSheet.getLastColumn()).getValues();
        const headerMap = dashRepo.getHeaderMap(dSheet);
        const codeCol = headerMap["dashboardCode"] - 1;
        for (let i = data.length - 1; i >= 0; i--) {
          if (data[i][codeCol] && data[i][codeCol].indexOf("TEST_STAGE10_") === 0) {
            dSheet.deleteRow(i + 2);
          }
        }
      }
    } catch (e) {}

    // 1. Test Dashboard Aggregation
    let dashCode = "TEST_STAGE10_OVERVIEW";
    try {
      const dash = dashSvc.rebuildDashboard(dashCode, actorContext);
      assert(dash.dashboardCode === dashCode, "Dashboard code mismatch: " + dash.dashboardCode);
      assert(dash.freshnessStatus === "CURRENT", "Freshness status should be CURRENT");
      const payload = JSON.parse(dash.metricPayloadJson);
      assert(payload.totalSchools === 12, "Aggregated schools count invalid: " + payload.totalSchools);
    } catch (e) {
      assert(false, "Dashboard rebuild failed: " + e.toString());
    }

    // 2. Test Leaderboard Generation (Sorting check)
    try {
      const leader = leaderSvc.generateLeaderboard("SCHOOL_MEDAL_STANDINGS", actorContext);
      assert(leader.leaderboardType === "SCHOOL_MEDAL_STANDINGS", "Leaderboard type mismatch");
      const standings = JSON.parse(leader.payloadJson);
      assert(standings[0].schoolId === "SCH_SAKON_01", "Rank 1 school incorrect");
      assert(standings[0].gold > standings[1].gold, "Medal count sorting order invalid");
    } catch (e) {
      assert(false, "Leaderboard generation failed: " + e.toString());
    }

    // 3. Test Statistics snap trend
    try {
      const stat = statSvc.recordMetric("REG_TOTAL", "registrations", 45, actorContext);
      assert(stat.metricCode === "REG_TOTAL", "Statistic metric code mismatch");
      assert(stat.numericValue === 45, "Statistic numeric value mismatch");
    } catch (e) {
      assert(false, "Statistics trend logging failed: " + e.toString());
    }

    // 4. Test Report Request & Build Lifecycle
    try {
      const req = {
        reportCode: "REGISTRATION_ROSTER",
        reportName: "ทำเนียบผู้ลงทะเบียนโครงการพระราชดำริ",
        format: "CSV",
        filters: { schoolId: "SCH_SAKON_01" }
      };

      const created = reportSvc.requestReport(req, actorContext);
      assert(created.reportStatus === "REQUESTED", "Report status should be REQUESTED");

      // Process report job
      const processed = reportSvc.processReportJob(created.reportId, actorContext);
      assert(processed.reportStatus === "AVAILABLE", "Report status should be AVAILABLE");
      assert(!!processed.outputFileId, "Drive output file ID invalid");
    } catch (e) {
      assert(false, "Report build lifecycle failed: " + e.toString());
    }

    // 5. Test Data Quality Scan
    try {
      const dqRes = dqSvc.runDataQualityScan(tenantId);
      assert(dqRes.success === true, "Data quality scan failed");
      assert(Array.isArray(dqRes.anomalies), "Data quality anomalies check format invalid");
    } catch (e) {
      assert(false, "Data quality check failed: " + e.toString());
    }

    return results;
  }
};
