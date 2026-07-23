/**
 * Competition Platform Engineering Standards (CPES)
 * Stage 6 - Competition Operations & Timetable Scheduling Tests
 */

const CMPE_STAGE6_TESTS = {
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

    const judgeRepo = new JudgeRepository();
    const assignmentRepo = new JudgeAssignmentRepository();
    const checkinRepo = new CheckInRepository();
    const roomRepo = new CompetitionRoomRepository();
    const scheduleRepo = new RoomScheduleRepository();
    const announcementRepo = new AnnouncementRepository();

    const judgeConflictSvc = new JudgeConflictService(assignmentRepo);
    const scheduleConflictSvc = new ScheduleConflictService(scheduleRepo);

    const judgeAppSvc = new JudgeApplicationService(judgeRepo);
    const assignmentSvc = new JudgeAssignmentService(assignmentRepo, judgeRepo, judgeConflictSvc);
    const roomSvc = new CompetitionRoomService(roomRepo);
    const scheduleSvc = new ScheduleApplicationService(scheduleRepo, scheduleConflictSvc);
    const readinessSvc = new OperationalReadinessService(new RegistrationRepository(), roomRepo, assignmentRepo);
    const checkinSvc = new CheckInApplicationService(checkinRepo);
    const announceSvc = new AnnouncementApplicationService(announcementRepo);

    Logger.log("--- Starting Stage 6 Competition Operations & Scheduling Tests ---");

    // Clean old test operation records
    try {
      const jSheet = judgeRepo.getSheet();
      if (jSheet.getLastRow() > 1) {
        const data = jSheet.getRange(2, 1, jSheet.getLastRow() - 1, jSheet.getLastColumn()).getValues();
        const headerMap = judgeRepo.getHeaderMap(jSheet);
        const codeCol = headerMap["judgeCode"] - 1;
        for (let i = data.length - 1; i >= 0; i--) {
          if (data[i][codeCol] && data[i][codeCol].indexOf("JDG_TEST") === 0) {
            jSheet.deleteRow(i + 2);
          }
        }
      }
    } catch (e) {}

    // 1. Test Judge Registration & Duplicate Code Constraints
    let judgeIdA = "JDG_TEST_A";
    let judgeIdB = "JDG_TEST_B";
    try {
      const jData1 = {
        judgeId: judgeIdA,
        judgeCode: "JDG_TEST_CODE_01",
        firstNameTh: "สมศักดิ์",
        lastNameTh: "เชี่ยวชาญ",
        judgeStatus: "ACTIVE",
        tenantId: tenantId
      };
      judgeAppSvc.createJudge(jData1, actorContext);

      // Duplicate check: same code should reject!
      try {
        judgeAppSvc.createJudge(jData1, actorContext);
        assert(false, "Allowed duplicate judgeCode creation");
      } catch (err) {
        assert(err.message.indexOf("ERR_DUPLICATE_JUDGE_CODE") !== -1, "Duplicate code check failed to throw correct error");
      }

      // Create Judge B
      const jData2 = {
        judgeId: judgeIdB,
        judgeCode: "JDG_TEST_CODE_02",
        firstNameTh: "อารีย์",
        lastNameTh: "เก่งกล้า",
        judgeStatus: "ACTIVE",
        tenantId: tenantId
      };
      judgeAppSvc.createJudge(jData2, actorContext);
    } catch (e) {
      assert(false, "Judge directory tests failed: " + e.toString());
    }

    // 2. Test Judge Assignment & Overlap Conflict Constraints
    let roundId = "RND_STAGE4_TEST";
    try {
      // Assign Judge A as SCORE_JUDGE from 10:00 to 12:00
      const assign1 = {
        judgeId: judgeIdA,
        competitionRoundId: roundId,
        judgeRole: "SCORE_JUDGE",
        assignmentStartTimestamp: "2026-08-01T10:00:00Z",
        assignmentEndTimestamp: "2026-08-01T12:00:00Z",
        tenantId: tenantId
      };
      assignmentSvc.assignJudge(assign1, actorContext);

      // Overlapping assignment check: Judge A from 11:00 to 13:00 should throw overlap error!
      const assignOverlap = {
        judgeId: judgeIdA,
        competitionRoundId: roundId,
        judgeRole: "SCORE_JUDGE",
        assignmentStartTimestamp: "2026-08-01T11:00:00Z",
        assignmentEndTimestamp: "2026-08-01T13:00:00Z",
        tenantId: tenantId
      };
      try {
        assignmentSvc.assignJudge(assignOverlap, actorContext);
        assert(false, "Allowed overlapping judge assignment periods");
      } catch (err) {
        assert(err.message.indexOf("ERR_JUDGE_OVERLAP") !== -1, "Judge overlap verification failed: " + err.message);
      }
    } catch (e) {
      assert(false, "Judge assignment tests failed: " + e.toString());
    }

    // 3. Test Chief Judge Constraints (only one active chief allowed per round)
    try {
      // Assign Judge A as CHIEF_JUDGE
      const assignChief1 = {
        judgeId: judgeIdA,
        competitionRoundId: roundId,
        judgeRole: "CHIEF_JUDGE",
        assignmentStartTimestamp: "2026-08-01T14:00:00Z",
        assignmentEndTimestamp: "2026-08-01T15:00:00Z",
        tenantId: tenantId
      };
      assignmentSvc.assignJudge(assignChief1, actorContext);

      // Assign Judge B as CHIEF_JUDGE to same round (should throw chief judge exists error!)
      const assignChief2 = {
        judgeId: judgeIdB,
        competitionRoundId: roundId,
        judgeRole: "CHIEF_JUDGE",
        assignmentStartTimestamp: "2026-08-01T14:00:00Z",
        assignmentEndTimestamp: "2026-08-01T15:00:00Z",
        tenantId: tenantId
      };
      try {
        assignmentSvc.assignJudge(assignChief2, actorContext);
        assert(false, "Allowed multiple Chief Judges in one round");
      } catch (err) {
        assert(err.message.indexOf("ERR_CHIEF_JUDGE_EXISTS") !== -1, "Chief Judge collision validation failed: " + err.message);
      }
    } catch (e) {
      assert(false, "Chief Judge constraints tests failed: " + e.toString());
    }

    // 4. Test Room Scheduling & Overlapping bookings constraints
    let roomId = "RM_TEST_01";
    try {
      const room = {
        competitionRoomId: roomId,
        competitionId: "COMP_STAGE4_TEST_01",
        venueId: "VEN_STAGE3_TEST",
        roomCode: "RM_TEST_CODE_01",
        roomNameTh: "ห้องแล็บวิทยาศาสตร์",
        tenantId: tenantId
      };
      roomSvc.createRoom(room, actorContext);

      // Book Room from 14:00 to 16:00
      const sched1 = {
        competitionRoomId: roomId,
        competitionId: "COMP_STAGE4_TEST_01",
        startTimestamp: "2026-08-01T14:00:00Z",
        endTimestamp: "2026-08-01T16:00:00Z",
        tenantId: tenantId
      };
      scheduleSvc.createScheduleSlot(sched1, actorContext);

      // Try booking same room from 15:00 to 17:00 (should reject!)
      const schedOverlap = {
        competitionRoomId: roomId,
        competitionId: "COMP_STAGE4_TEST_01",
        startTimestamp: "2026-08-01T15:00:00Z",
        endTimestamp: "2026-08-01T17:00:00Z",
        tenantId: tenantId
      };
      try {
        scheduleSvc.createScheduleSlot(schedOverlap, actorContext);
        assert(false, "Allowed room scheduling double booking overlap");
      } catch (err) {
        assert(err.message.indexOf("ERR_ROOM_OVERLAP") !== -1, "Room overlap checking failed");
      }

      // Invalid schedule period (end before start)
      const schedInvalid = {
        competitionRoomId: roomId,
        competitionId: "COMP_STAGE4_TEST_01",
        startTimestamp: "2026-08-01T15:00:00Z",
        endTimestamp: "2026-08-01T14:00:00Z",
        tenantId: tenantId
      };
      try {
        scheduleSvc.createScheduleSlot(schedInvalid, actorContext);
        assert(false, "Allowed invalid schedule period (end before start)");
      } catch (err) {
        assert(err.message.indexOf("ERR_INVALID_SCHEDULE_PERIOD") !== -1, "Invalid period check failed");
      }
    } catch (e) {
      assert(false, "Rooms and schedules tests failed: " + e.toString());
    }

    // 5. Test Check-in Operations & Reversals (Append-only style logs)
    try {
      const checkin = {
        competitionId: "COMP_STAGE4_TEST_01",
        registrationId: "COMP_STAGE4_TEST_01",
        subjectType: "TEAM",
        subjectId: "REG_TEST_01",
        checkinMethod: "MANUAL",
        tenantId: tenantId
      };
      const log = checkinSvc.recordCheckIn(checkin, actorContext);
      assert(log.checkinStatus === "CHECKED_IN", "Checkin status incorrect");

      // Reversal:
      const reversed = checkinSvc.reverseCheckIn(log.checkinLogId, "ผิดห้อง", actorContext);
      assert(reversed.checkinStatus === "REVERSED", "Checkin reversal status incorrect");
      assert(reversed.reversalOfCheckinLogId === log.checkinLogId, "Checkin reversal mapping mismatch");
      assert(reversed.reversalReason === "ผิดห้อง", "Checkin reversal reason missing");

      // Verify that reversing without reason is rejected
      try {
        checkinSvc.reverseCheckIn(log.checkinLogId, "", actorContext);
        assert(false, "Allowed reversal without reason");
      } catch (err) {
        assert(err.message.indexOf("ERR_REVERSAL_REASON_REQUIRED") !== -1, "Reversal reason validation failed");
      }
    } catch (e) {
      assert(false, "Checkin operations tests failed: " + e.toString());
    }

    // 6. Test Operational Readiness
    try {
      const readRes = readinessSvc.validateReadiness("COMP_STAGE4_TEST_01", tenantId);
      assert(readRes.status === "READY", "Readiness check failed: " + JSON.stringify(readRes));
    } catch (e) {
      assert(false, "Readiness tests failed: " + e.toString());
    }

    return results;
  }
};
