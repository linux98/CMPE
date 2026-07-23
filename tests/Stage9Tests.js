/**
 * Competition Platform Engineering Standards (CPES)
 * Stage 9 - Notification Bounded Context Tests
 */

const CMPE_STAGE9_TESTS = {
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

    const notifyRepo = new NotificationRepository();
    const tgRepo = new TelegramQueueRepository();
    const emailRepo = new EmailQueueRepository();
    const smsRepo = new SmsQueueRepository();

    const creationSvc = new NotificationCreationService(notifyRepo);
    const routingSvc = new ChannelRoutingService(tgRepo, emailRepo, smsRepo);

    const tgSvc = new TelegramQueueService(tgRepo);
    const emailSvc = new EmailQueueService(emailRepo);
    const smsSvc = new SmsQueueService(smsRepo);
    const staleSvc = new StaleNotificationService(notifyRepo, tgRepo, emailRepo, smsRepo);

    Logger.log("--- Starting Stage 9 Notification Queue Tests ---");

    // Clean old test records
    try {
      const nSheet = notifyRepo.getSheet();
      if (nSheet.getLastRow() > 1) {
        const data = nSheet.getRange(2, 1, nSheet.getLastRow() - 1, nSheet.getLastColumn()).getValues();
        const headerMap = notifyRepo.getHeaderMap(nSheet);
        const codeCol = headerMap["notificationCode"] - 1;
        for (let i = data.length - 1; i >= 0; i--) {
          if (data[i][codeCol] && data[i][codeCol].indexOf("TEST_STAGE9_") === 0) {
            nSheet.deleteRow(i + 2);
          }
        }
      }
    } catch (e) {}

    // 1. Test Notification Creation & Idempotency Key
    let notif1;
    try {
      const payload = {
        notificationId: "NTF_STG9_01",
        notificationCode: "TEST_STAGE9_SUBMITTED",
        notificationType: "REGISTRATION_SUBMITTED",
        sourceContext: "REGISTRATION",
        sourceEntityType: "registrations",
        sourceEntityId: "REG_STG9_TEST_01",
        sourceVersion: 1,
        idempotencyKey: "IDEM_STG9_001",
        priority: "HIGH",
        tenantId: tenantId
      };
      
      notif1 = creationSvc.createNotification(payload, actorContext);
      assert(notif1.notificationStatus === "CREATED", "Notification status should be CREATED");
      assert(notif1.idempotencyKey === "IDEM_STG9_001", "Idempotency key mismatch");

      // Idempotency: verify creating another with same key returns existing
      const duplicate = creationSvc.createNotification(payload, actorContext);
      assert(duplicate.notificationId === notif1.notificationId, "Idempotency key did not reuse existing notification");
    } catch (e) {
      assert(false, "Notification creation failed: " + e.toString());
    }

    // 2. Test Channel Routing
    try {
      const recipientAddress = {
        email: "test-recipient@domain.com",
        telegramChatId: "-10022334455",
        phone: "0812345678"
      };
      
      const routed = routingSvc.routeNotification(notif1, ["TELEGRAM", "EMAIL", "SMS"], recipientAddress, actorContext);
      assert(routed.length === 3, "Failed to route to all 3 requested channels: " + routed.length);
    } catch (e) {
      assert(false, "Channel routing failed: " + e.toString());
    }

    // 3. Test Queue Processing (Telegram & Email)
    try {
      const tgSuccess = tgSvc.processTelegramQueue(5, actorContext);
      assert(tgSuccess > 0, "No telegram queue item was successfully processed");

      const emailSuccess = emailSvc.processEmailQueue(5, actorContext);
      assert(emailSuccess > 0, "No email queue item was successfully processed");
    } catch (e) {
      assert(false, "Queue processing failed: " + e.toString());
    }

    // 4. Test Dead-Letter (Permanent Delivery Failures)
    try {
      // Queue a message with bad destination format
      const badNotif = creationSvc.createNotification({
        notificationId: "NTF_STG9_BAD",
        notificationCode: "TEST_STAGE9_BAD_DEST",
        notificationType: "REGISTRATION_SUBMITTED",
        tenantId: tenantId
      }, actorContext);

      routingSvc.routeNotification(badNotif, ["EMAIL"], { email: "invalid-email-address" }, actorContext);

      // Process up to max attempts (3 attempts)
      for (let i = 0; i < 3; i++) {
        emailSvc.processEmailQueue(5, actorContext);
      }

      // Check if queue item status transitioned to DEAD_LETTER
      const eSheet = emailRepo.getSheet();
      const headerMap = emailRepo.getHeaderMap(eSheet);
      const data = eSheet.getRange(2, 1, eSheet.getLastRow() - 1, eSheet.getLastColumn()).getValues();
      const notCol = headerMap["notificationId"] - 1;
      const statusCol = headerMap["deliveryStatus"] - 1;
      const failCol = headerMap["failureCategory"] - 1;

      let deadLetterFound = false;
      for (let i = 0; i < data.length; i++) {
        if (data[i][notCol] === "NTF_STG9_BAD" && data[i][statusCol] === "DEAD_LETTER") {
          deadLetterFound = true;
          assert(data[i][failCol] === "PERMANENT_RECIPIENT_ERROR", "Dead-letter category mismatch: " + data[i][failCol]);
          break;
        }
      }
      assert(deadLetterFound, "Permanent error did not transition to DEAD_LETTER status after max attempts");
    } catch (e) {
      assert(false, "Dead-letter tests failed: " + e.toString());
    }

    // 5. Test Stale Notification Detection
    try {
      // Queue a notification for version 1
      const v1Notif = creationSvc.createNotification({
        notificationId: "NTF_STG9_V1",
        notificationCode: "TEST_STAGE9_STALE_FLOW",
        sourceEntityType: "registrations",
        sourceEntityId: "REG_STG9_STALE_ID",
        sourceVersion: 1,
        tenantId: tenantId
      }, actorContext);

      routingSvc.routeNotification(v1Notif, ["TELEGRAM"], { telegramChatId: "-10099" }, actorContext);

      // Trigger stale check with version 2
      const staleCount = staleSvc.detectAndMarkStale("registrations", "REG_STG9_STALE_ID", 2, tenantId);
      assert(staleCount > 0, "No stale notification was detected");

      // Verify that version 1 status is now STALE
      const nSheet = notifyRepo.getSheet();
      const headerMap = notifyRepo.getHeaderMap(nSheet);
      const data = nSheet.getRange(2, 1, nSheet.getLastRow() - 1, nSheet.getLastColumn()).getValues();
      const idCol = headerMap["notificationId"] - 1;
      const statusCol = headerMap["notificationStatus"] - 1;

      let isStale = false;
      for (let i = 0; i < data.length; i++) {
        if (data[i][idCol] === "NTF_STG9_V1") {
          isStale = (data[i][statusCol] === "STALE");
          break;
        }
      }
      assert(isStale, "Obsolete notification version did not transition to STALE state");
    } catch (e) {
      assert(false, "Stale notifications tests failed: " + e.toString());
    }

    return results;
  }
};
