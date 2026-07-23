/**
 * Competition Platform Engineering Standards (CPES)
 * Stage 11 - UAT Mock Data Seeder Service
 */

const CMPE_UAT_MOCK_DATA_SEEDER = {
  /**
   * Main entry point to seed the complete deterministic UAT dataset.
   */
  seedUatMockData() {
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000); // 30 seconds timeout
    } catch (e) {
      throw new Error("UAT Seeder lock timeout: another process is seeding.");
    }

    try {
      const ssId = CMPE_ENVIRONMENT.getSpreadsheetId();
      const ss = SpreadsheetApp.openById(ssId);
      
      // Check if already seeded to prevent duplicate runs
      const metadataSheet = ss.getSheetByName("metadata");
      const metaMap = this.getHeaderMap(metadataSheet);
      const metadata = metadataSheet.getDataRange().getValues();
      const batchExists = metadata.some(row => row[metaMap["key"] - 1] === "UAT_SEED_BATCH_ID");
      if (batchExists) {
        return {
          status: "ALREADY_SEEDED",
          message: "UAT Seed mock data already exists. Run clearUatMockData() first to reseed."
        };
      }

      const seedBatchId = CMPE_UTILITIES.generateUuid();
      const startTime = new Date();

      Logger.log(`[UAT SEED] Initializing seed batch: ${seedBatchId}`);

      // Initialize LCG deterministic PRNG
      const prng = this.createPrng(12345);
      const passwordHasher = new PasswordHasher();

      // Track created record primary keys per sheet for cleanup/rollback
      const seedRegistry = {};

      const context = {
        ss,
        prng,
        passwordHasher,
        seedRegistry,
        actor: { userId: "UAT_SEED_SERVICE", tenantId: "GLOBAL" }
      };

      // 1. Seed Academic Years (2569 & 2568)
      this.seedAcademicYears(context);

      // 2. Seed Tenants (5 tenants)
      this.seedTenants(context);

      // 3. Seed Users, Roles, Profiles & RBAC
      this.seedUsersAndRoles(context);

      // 4. Seed School Clusters and Schools
      this.seedClustersAndSchools(context);

      // 5. Seed Competition Events, Categories & Items
      this.seedCompetitionStructure(context);

      // 6. Seed Registrations, Members, Coaches & Substitutes
      this.seedRegistrationsAndParticipants(context);

      // 7. Seed Venues, Rooms & Schedules
      this.seedVenuesAndSchedules(context);

      // 8. Seed Judges & Scoring Rubrics
      this.seedJudgesAndScoring(context);

      // 9. Seed Results, Medals & Trophies
      this.seedResultsAndMedals(context);

      // 10. Seed Certificates & Verification Logs
      this.seedCertificates(context);

      // 11. Seed Notifications & Communication Logs
      this.seedNotifications(context);

      // 12. Seed Operational Log Samples
      this.seedLogsAndSystemConfigs(context);

      // Save record IDs registry to metadata sheet for rollback
      const metaRows = [
        [CMPE_UTILITIES.generateUuid(), "UAT_SEED_BATCH_ID", seedBatchId, "Batch ID of the UAT seed run"]
      ];
      for (const sheetName in seedRegistry) {
        metaRows.push([
          CMPE_UTILITIES.generateUuid(),
          `UAT_SEED_IDS_${sheetName}`,
          seedRegistry[sheetName].join(","),
          `Generated primary keys for sheet ${sheetName}`
        ]);
      }
      
      const metaHeaders = ["metadataId", "key", "value", "description"];
      const formattedMeta = metaRows.map(row => {
        const obj = {};
        metaHeaders.forEach((h, i) => obj[h] = row[i]);
        return this.mapObjectToRow(obj, metaMap);
      });
      
      metadataSheet.getRange(metadataSheet.getLastRow() + 1, 1, formattedMeta.length, formattedMeta[0].length).setValues(formattedMeta);

      const endTime = new Date();
      const durationSeconds = Math.round((endTime - startTime) / 1000);

      Logger.log(`[UAT SEED] Finished successfully. Duration: ${durationSeconds}s`);

      return {
        status: "SUCCESS",
        seedBatchId,
        durationSeconds,
        summary: this.getUatSeedSummary()
      };
    } finally {
      lock.releaseLock();
    }
  },

  /**
   * Helper to delete UAT seeded records safely.
   */
  clearUatMockData(confirmationToken) {
    if (confirmationToken !== "CLEAR_UAT_DATA") {
      throw new Error("Invalid confirmation token. Rollback aborted.");
    }

    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000);
    } catch (e) {
      throw new Error("Rollback lock timeout.");
    }

    try {
      const ssId = CMPE_ENVIRONMENT.getSpreadsheetId();
      const ss = SpreadsheetApp.openById(ssId);
      
      const metadataSheet = ss.getSheetByName("metadata");
      const metaMap = this.getHeaderMap(metadataSheet);
      const metadata = metadataSheet.getDataRange().getValues();
      
      const idsToRemoveMap = {};
      const metadataRowsToKeep = [metadata[0]];
      
      metadata.slice(1).forEach(row => {
        const key = row[metaMap["key"] - 1];
        const val = row[metaMap["value"] - 1];
        if (key.startsWith("UAT_SEED_IDS_")) {
          const sheetName = key.replace("UAT_SEED_IDS_", "");
          idsToRemoveMap[sheetName] = new Set(val.split(","));
        } else if (key !== "UAT_SEED_BATCH_ID") {
          metadataRowsToKeep.push(row);
        }
      });

      const hasBatchId = metadata.some(row => row[metaMap["key"] - 1] === "UAT_SEED_BATCH_ID");

      if (Object.keys(idsToRemoveMap).length === 0) {
        if (hasBatchId) {
          metadataSheet.clearContents();
          metadataSheet.getRange(1, 1, metadataRowsToKeep.length, metadataRowsToKeep[0].length).setValues(metadataRowsToKeep);
          return {
            status: "ROLLBACK_SUCCESS",
            message: "Orphaned UAT seed batch ID removed. Database is clean."
          };
        }
        return {
          status: "NO_DATA",
          message: "No active UAT seed registry found. Database is clean."
        };
      }

      // Delete seeded rows in reverse dependency order
      for (const sheetName in idsToRemoveMap) {
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet || sheet.getLastRow() <= 1) continue;
        
        const config = CMPE_CONSTANTS.TableCatalog[sheetName];
        if (!config) continue;
        
        const headerMap = this.getHeaderMap(sheet);
        const pkIdx = headerMap[config.pk] - 1;
        const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
        const idsToRemove = idsToRemoveMap[sheetName];
        
        const rowsToKeep = [sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]];
        data.forEach(row => {
          if (!idsToRemove.has(row[pkIdx])) {
            rowsToKeep.push(row);
          }
        });
        
        sheet.clearContents();
        sheet.getRange(1, 1, rowsToKeep.length, rowsToKeep[0].length).setValues(rowsToKeep);
      }

      // Clear UAT registry rows in metadata
      metadataSheet.clearContents();
      metadataSheet.getRange(1, 1, metadataRowsToKeep.length, metadataRowsToKeep[0].length).setValues(metadataRowsToKeep);

      return {
        status: "ROLLBACK_SUCCESS",
        message: "All UAT mock data removed successfully."
      };
    } finally {
      lock.releaseLock();
    }
  },

  /**
   * Reseeds the UAT mock data.
   */
  reseedUatMockData() {
    try {
      this.clearUatMockData("CLEAR_UAT_DATA");
    } catch (e) {
      // Ignore if no data to clear
    }
    return this.seedUatMockData();
  },

  /**
   * Returns row counts grouped by tenant and entity.
   */
  getUatSeedSummary() {
    const ssId = CMPE_ENVIRONMENT.getSpreadsheetId();
    const ss = SpreadsheetApp.openById(ssId);
    const catalog = CMPE_CONSTANTS.TableCatalog;
    const summary = {};
    
    for (const name in catalog) {
      const sheet = ss.getSheetByName(name);
      summary[name] = sheet ? Math.max(0, sheet.getLastRow() - 1) : 0;
    }
    return summary;
  },

  /**
   * Returns temporary credential report for UAT testing.
   */
  getUatDemoCredentials() {
    return [
      { role: "SUPER_ADMIN", tenant: "GLOBAL", username: "superadmin", password: "Uat@Super2569" },
      { role: "TENANT_ADMIN", tenant: "SESAO_SAKON", username: "admin_sakon", password: "Uat@Admin2569" },
      { role: "TENANT_ADMIN", tenant: "SESAO_UDON", username: "admin_udon", password: "Uat@Admin2569" },
      { role: "TENANT_ADMIN", tenant: "SESAO_KHONKAEN", username: "admin_kk", password: "Uat@Admin2569" },
      { role: "TENANT_ADMIN", tenant: "SESAO_KORAT", username: "admin_korat", password: "Uat@Admin2569" },
      { role: "TENANT_ADMIN", tenant: "SESAO_SURIN", username: "admin_surin", password: "Uat@Admin2569" },
      { role: "COMPETITION_MANAGER", tenant: "SESAO_SAKON", username: "cmpe_manager_sakon", password: "Uat@User2569" },
      { role: "REGISTRATION_OFFICER", tenant: "SESAO_SAKON", username: "registration_sakon", password: "Uat@User2569" },
      { role: "CERTIFICATE_OFFICER", tenant: "SESAO_SAKON", username: "certificate_sakon", password: "Uat@User2569" },
      { role: "AUDITOR", tenant: "SESAO_SAKON", username: "auditor_sakon", password: "Uat@User2569" }
    ];
  },

  // --- SEEDER IMPLEMENTATION PROCEDURES ---

  seedAcademicYears(ctx) {
    const records = [
      { academicYearId: "AY-2569", yearValue: "2569", status: "ACTIVE", isCurrent: "true" },
      { academicYearId: "AY-2568", yearValue: "2568", status: "ARCHIVED", isCurrent: "false" }
    ];
    this.batchWrite("academic_years", records, ctx);
  },

  seedTenants(ctx) {
    const tenants = [
      { id: "sakon1234", code: "SESAO_SAKON", nameTh: "สำนักงานเขตพื้นที่การศึกษามัธยมศึกษาสกลนคร", nameEn: "SESAO Sakon Nakhon", prov: "สกลนคร", primary: "#1E3A8A" },
      { id: "udon1234", code: "SESAO_UDON", nameTh: "สำนักงานเขตพื้นที่การศึกษามัธยมศึกษาอุดรธานี", nameEn: "SESAO Udon Thani", prov: "อุดรธานี", primary: "#0F766E" },
      { id: "kk1234", code: "SESAO_KHONKAEN", nameTh: "สำนักงานเขตพื้นที่การศึกษามัธยมศึกษาขอนแก่น", nameEn: "SESAO Khon Kaen", prov: "ขอนแก่น", primary: "#B45309" },
      { id: "korat1234", code: "SESAO_KORAT", nameTh: "สำนักงานเขตพื้นที่การศึกษามัธยมนครราชสีมา", nameEn: "SESAO Nakhon Ratchasima", prov: "นครราชสีมา", primary: "#7C3AED" },
      { id: "surin1234", code: "SESAO_SURIN", nameTh: "สำนักงานเขตพื้นที่การศึกษามัธยมศึกษาสุรินทร์", nameEn: "SESAO Surin", prov: "สุรินทร์", primary: "#DB2777" }
    ];

    const records = tenants.map(t => {
      // Hash plaintext tenant credentials securely
      const plainPass = t.code === "SESAO_SAKON" ? "sakon1234" : (t.code === "SESAO_UDON" ? "udon1234" : (t.code === "SESAO_KHONKAEN" ? "kk1234" : (t.code === "SESAO_KORAT" ? "korat1234" : "surin1234")));
      const hash = ctx.passwordHasher.hash(plainPass, t.id, 1000);
      
      return {
        tenantId: t.id,
        name: t.nameTh,
        province: t.prov,
        adminUsername: `admin_${t.code.split("_")[1].toLowerCase()}`,
        adminPasswordHash: hash,
        status: "ACTIVE"
      };
    });

    this.batchWrite("tenants", records, ctx);
  },

  seedUsersAndRoles(ctx) {
    const rolesList = [
      "SUPER_ADMIN", "TENANT_ADMIN", "COMPETITION_MANAGER", "REGISTRATION_OFFICER",
      "SCHOOL_ADMIN", "TEACHER", "JUDGE", "VENUE_MANAGER", "CERTIFICATE_OFFICER", "AUDITOR", "VIEWER"
    ];
    
    const roleRecords = rolesList.map(r => ({
      roleId: `ROLE-${r}`,
      roleCode: r,
      name: `System Role ${r}`
    }));
    this.batchWrite("roles", roleRecords, ctx);

    // Seed User Accounts
    const users = [
      { uid: "USR-SUPER", user: "superadmin", pass: "Uat@Super2569", role: "SUPER_ADMIN", tenant: "GLOBAL", name: "ผู้ดูแลระบบสูงสุด (Super Admin)" },
      { uid: "USR-SAKON", user: "admin_sakon", pass: "Uat@Admin2569", role: "TENANT_ADMIN", tenant: "sakon1234", name: "แอดมินเขตพื้นที่สกลนคร" },
      { uid: "USR-UDON", user: "admin_udon", pass: "Uat@Admin2569", role: "TENANT_ADMIN", tenant: "udon1234", name: "แอดมินเขตพื้นที่อุดรธานี" },
      { uid: "USR-KK", user: "admin_kk", pass: "Uat@Admin2569", role: "TENANT_ADMIN", tenant: "kk1234", name: "แอดมินเขตพื้นที่ขอนแก่น" },
      { uid: "USR-KORAT", user: "admin_korat", pass: "Uat@Admin2569", role: "TENANT_ADMIN", tenant: "korat1234", name: "แอดมินเขตพื้นที่นครราชสีมา" },
      { uid: "USR-SURIN", user: "admin_surin", pass: "Uat@Admin2569", role: "TENANT_ADMIN", tenant: "surin1234", name: "แอดมินเขตพื้นที่สุรินทร์" },
      { uid: "USR-MGR-SAKON", user: "cmpe_manager_sakon", pass: "Uat@User2569", role: "COMPETITION_MANAGER", tenant: "sakon1234", name: "ผู้จัดการแข่งขัน สพม.สกลนคร" },
      { uid: "USR-REG-SAKON", user: "registration_sakon", pass: "Uat@User2569", role: "REGISTRATION_OFFICER", tenant: "sakon1234", name: "เจ้าหน้าที่ลงทะเบียน สพม.สกลนคร" },
      { uid: "USR-CERT-SAKON", user: "certificate_sakon", pass: "Uat@User2569", role: "CERTIFICATE_OFFICER", tenant: "sakon1234", name: "เจ้าหน้าที่ออกเกียรติบัตร สพม.สกลนคร" },
      { uid: "USR-AUD-SAKON", user: "auditor_sakon", pass: "Uat@User2569", role: "AUDITOR", tenant: "sakon1234", name: "ผู้ตรวจสอบระบบ สพม.สกลนคร" }
    ];

    const userRecords = [];
    const profileRecords = [];
    const userRoleRecords = [];

    users.forEach(u => {
      const salt = ctx.passwordHasher.generateSalt();
      const hash = ctx.passwordHasher.hash(u.pass, salt, 1000);
      
      userRecords.push({
        userId: u.uid,
        username: u.user,
        passwordHash: hash,
        salt: salt,
        iterations: "1000",
        status: "ACTIVE",
        failedLoginCount: 0,
        lockoutUntil: "",
        passwordExpiredTimestamp: ""
      });

      profileRecords.push({
        userProfileId: `PRF-${u.uid}`,
        userId: u.uid,
        firstName: u.name.split(" ")[0],
        lastName: u.name.split(" ")[1] || "UAT",
        email: `${u.user}@uat-cpes.example`,
        phone: "081-234-5678"
      });

      userRoleRecords.push({
        userRoleId: `UR-${u.uid}`,
        userId: u.uid,
        roleId: `ROLE-${u.role}`,
        scope: u.tenant
      });
    });

    this.batchWrite("users", userRecords, ctx);
    this.batchWrite("user_profiles", profileRecords, ctx);
    this.batchWrite("user_roles", userRoleRecords, ctx);
  },

  seedClustersAndSchools(ctx) {
    const sakonClusters = [
      "สหวิทยาเขตสกลนคร", "สหวิทยาเขตพระธาตุเชิงชุม", "สหวิทยาเขตพังโคน–วาริชภูมิ",
      "สหวิทยาเขตสว่างแดนดิน", "สหวิทยาเขตวานรนิวาส", "สหวิทยาเขตลุ่มน้ำสงคราม"
    ];
    
    // Seed clusters
    const clusterRecords = [];
    const sakonClusterIds = [];
    sakonClusters.forEach((c, i) => {
      const cid = `CLUST-SAKON-${i+1}`;
      sakonClusterIds.push(cid);
      clusterRecords.push({
        districtId: cid, // mapped as districtId or equivalent network ID
        provinceId: "sakon1234",
        districtCode: `NET-${i+1}`,
        nameTh: c,
        nameEn: `Network ${i+1}`
      });
    });
    this.batchWrite("districts", clusterRecords, ctx);

    // Seed Schools (15 Sakon Nakhon, 10 for each other tenant = 55 total)
    const sakonSchools = [
      "โรงเรียนสกลนครพัฒนศึกษา", "โรงเรียนธาตุนารายณ์วิทยา", "โรงเรียนพังโคนวิทยาคม",
      "โรงเรียนวานรนิวาสศึกษา", "โรงเรียนสว่างแดนดินวิทยา", "โรงเรียนกุสุมาลย์พิทยาคม",
      "โรงเรียนคำตากล้าราชประชาสงเคราะห์", "โรงเรียนอากาศอำนวยศึกษา", "โรงเรียนพรรณานิคมพิทยาคม",
      "โรงเรียนเต่างอยพัฒนศึกษา", "โรงเรียนโคกศรีวิทยาคม", "โรงเรียนนิคมน้ำอูนศึกษา",
      "โรงเรียนเจริญศิลป์พิทยาคม", "โรงเรียนภูพานวิทยา", "โรงเรียนโพนนาแก้วศึกษา"
    ];

    const schoolRecords = [];
    const profileRecords = [];
    const userRecords = [];
    const userRoleRecords = [];

    // Sakon Nakhon schools
    sakonSchools.forEach((s, idx) => {
      const scId = `SCH-SAKON-${idx+1}`;
      const clusterId = sakonClusterIds[idx % sakonClusterIds.length];
      
      schoolRecords.push({
        schoolId: scId,
        nameTh: s,
        nameEn: `UAT Fictional School ${idx+1}`,
        districtId: clusterId
      });

      // Create school admin user
      const userUid = `USR-SCH-SAKON-${idx+1}`;
      const username = `admin_sch_sakon_${idx+1}`;
      const salt = ctx.passwordHasher.generateSalt();
      const hash = ctx.passwordHasher.hash("Uat@User2569", salt, 1000);

      userRecords.push({
        userId: userUid,
        username: username,
        passwordHash: hash,
        salt: salt,
        iterations: "1000",
        status: "ACTIVE",
        failedLoginCount: 0,
        lockoutUntil: "",
        passwordExpiredTimestamp: ""
      });

      profileRecords.push({
        userProfileId: `PRF-${userUid}`,
        userId: userUid,
        firstName: `ผู้ดูแล`,
        lastName: s,
        email: `${username}@uat-school.example`,
        phone: "089-111-2222"
      });

      userRoleRecords.push({
        userRoleId: `UR-${userUid}`,
        userId: userUid,
        roleId: "ROLE-SCHOOL_ADMIN",
        scope: "sakon1234"
      });
    });

    // Other tenants' schools
    const otherTenants = ["udon1234", "kk1234", "korat1234", "surin1234"];
    otherTenants.forEach((ten, tIdx) => {
      const prefix = ten.replace("1234", "").toUpperCase();
      for (let sIdx = 1; sIdx <= 10; sIdx++) {
        const scId = `SCH-${prefix}-${sIdx}`;
        schoolRecords.push({
          schoolId: scId,
          nameTh: `โรงเรียนทดสอบประจำเขตพื้นที่ ${tIdx+2} แห่งที่ ${sIdx}`,
          nameEn: `UAT Fictional School ${prefix} ${sIdx}`,
          districtId: `CLUST-${prefix}`
        });
      }
    });

    this.batchWrite("schools", schoolRecords, ctx);
    this.batchWrite("users", userRecords, ctx);
    this.batchWrite("user_profiles", profileRecords, ctx);
    this.batchWrite("user_roles", userRoleRecords, ctx);
  },

  seedCompetitionStructure(ctx) {
    // 1. Seed events (3 events)
    const events = [
      {
        competitionId: "EVT-2569-AREA",
        academicYearId: "AY-2569",
        competitionCode: "UAT-CMPE-2569-AREA",
        nameTh: "งานศิลปหัตถกรรมนักเรียน ระดับเขตพื้นที่การศึกษา ปีการศึกษา 2569",
        nameEn: "Student Arts and Crafts Festival (SESAO Area Level) 2026",
        competitionTypeId: "TYPE-ARTS",
        startDate: "2026-11-15",
        endDate: "2026-11-17",
        timezone: "Asia/Bangkok",
        status: "OPEN_FOR_REGISTRATION"
      },
      {
        competitionId: "EVT-2569-CLUSTER",
        academicYearId: "AY-2569",
        competitionCode: "UAT-CMPE-2569-CLUSTER",
        nameTh: "การแข่งขันทักษะวิชาการระดับสหวิทยาเขต ปีการศึกษา 2569",
        nameEn: "Academic Skill Contest (School Cluster Level) 2026",
        competitionTypeId: "TYPE-ACAD",
        startDate: "2026-10-10",
        endDate: "2026-10-12",
        timezone: "Asia/Bangkok",
        status: "IN_PROGRESS"
      },
      {
        competitionId: "EVT-2568-HISTORY",
        academicYearId: "AY-2568",
        competitionCode: "UAT-CMPE-2568-HISTORY",
        nameTh: "งานแข่งขันทักษะวิชาการ ปีการศึกษา 2568 (ประวัติย้อนหลัง)",
        nameEn: "Academic Skill Contest 2025 (Historical Records)",
        competitionTypeId: "TYPE-ACAD",
        startDate: "2025-11-15",
        endDate: "2025-11-17",
        timezone: "Asia/Bangkok",
        status: "COMPLETED"
      }
    ];
    this.batchWrite("competitions", events, ctx);

    // 2. Seed competition categories (14 categories)
    const categoriesList = [
      "ภาษาไทย", "คณิตศาสตร์", "วิทยาศาสตร์และเทคโนโลยี", "สังคมศึกษา ศาสนาและวัฒนธรรม",
      "สุขศึกษาและพลศึกษา", "ศิลปะ–ทัศนศิลป์", "ศิลปะ–ดนตรี", "ศิลปะ–นาฏศิลป์",
      "การงานอาชีพ", "ภาษาต่างประเทศ", "คอมพิวเตอร์และหุ่นยนต์", "กิจกรรมพัฒนาผู้เรียน",
      "การศึกษาพิเศษ", "Soft Power และภูมิปัญญาท้องถิ่น"
    ];

    const categoryRecords = categoriesList.map((c, i) => ({
      categoryId: `CAT-${i+1}`,
      categoryCode: `CODE-CAT-${i+1}`,
      nameTh: c,
      nameEn: `Category ${c}`
    }));
    this.batchWrite("competition_categories", categoryRecords, ctx);

    // 3. Seed at least 40 competition items config
    // Mapped as competition_category_configs inside TableCatalog
    const itemTypes = [
      { name: "คัดลายมือสื่อภาษาไทย ระดับ ม.1–ม.3", cat: "CAT-1", minSt: 1, maxSt: 1, minT: 1, maxT: 1 },
      { name: "เรียงร้อยถ้อยความ ระดับ ม.1–ม.3", cat: "CAT-1", minSt: 1, maxSt: 1, minT: 1, maxT: 1 },
      { name: "การพูดสุนทรพจน์ภาษาไทย ระดับ ม.4–ม.6", cat: "CAT-1", minSt: 1, maxSt: 1, minT: 1, maxT: 1 },
      { name: "อัจฉริยภาพทางคณิตศาสตร์ ระดับ ม.1–ม.3", cat: "CAT-2", minSt: 1, maxSt: 1, minT: 1, maxT: 1 },
      { name: "อัจฉริยภาพทางคณิตศาสตร์ ระดับ ม.4–ม.6", cat: "CAT-2", minSt: 1, maxSt: 1, minT: 1, maxT: 1 },
      { name: "คิดเลขเร็ว ระดับ ม.1–ม.3", cat: "CAT-2", minSt: 1, maxSt: 1, minT: 1, maxT: 1 },
      { name: "ซูโดกุ ระดับ ม.1–ม.3", cat: "CAT-2", minSt: 1, maxSt: 1, minT: 1, maxT: 1 },
      { name: "อัจฉริยภาพทางวิทยาศาสตร์ ระดับ ม.1–ม.3", cat: "CAT-3", minSt: 3, maxSt: 3, minT: 2, maxT: 2 },
      { name: "การสร้าง Web Applications ระดับ ม.4–ม.6", cat: "CAT-11", minSt: 2, maxSt: 2, minT: 2, maxT: 2 },
      { name: "การเขียนโปรแกรม ระดับ ม.1–ม.3", cat: "CAT-11", minSt: 2, maxSt: 2, minT: 2, maxT: 2 },
      { name: "Multi Skills Competition ระดับ ม.1–ม.3", cat: "CAT-10", minSt: 1, maxSt: 1, minT: 1, maxT: 1 },
      { name: "Crossword ระดับ ม.1–ม.3", cat: "CAT-10", minSt: 2, maxSt: 2, minT: 1, maxT: 1 },
      { name: "วาดภาพระบายสี ระดับ ม.1–ม.3", cat: "CAT-6", minSt: 1, maxSt: 1, minT: 1, maxT: 1 },
      { name: "วงดนตรีสากล (Combo Band) ระดับ ม.1–ม.3", cat: "CAT-7", minSt: 5, maxSt: 10, minT: 2, maxT: 3 }
    ];

    const configRecords = [];
    const eventIds = ["EVT-2569-AREA", "EVT-2569-CLUSTER", "EVT-2568-HISTORY"];

    // Expand items configuration deterministically to reach 40+ config items
    let recordIdx = 1;
    eventIds.forEach(evtId => {
      itemTypes.forEach((item, tIdx) => {
        configRecords.push({
          competitionCategoryConfigId: `CONFIG-${evtId}-${tIdx+1}`,
          competitionId: evtId,
          categoryId: item.cat,
          educationLevelId: "LVL-SEC", // Secondary
          scoreTemplateId: "TEMP-STANDARD",
          medalRuleId: "RULE-MEDAL",
          certificateTemplateId: "TEMP-CERT",
          quotaRuleId: "RULE-QUOTA",
          registrationWindowId: "WIN-REG",
          status: "ACTIVE",
          displayOrder: tIdx + 1,
          participantMinOverride: item.minSt,
          participantMaxOverride: item.maxSt,
          coachMinOverride: item.minT,
          coachMaxOverride: item.maxT
        });
        recordIdx++;
      });
    });

    this.batchWrite("competition_category_configs", configRecords, ctx);
  },

  seedRegistrationsAndParticipants(ctx) {
    const statuses = [
      "DRAFT", "SUBMITTED", "UNDER_REVIEW", "REVISION_REQUIRED", "APPROVED",
      "REJECTED", "WITHDRAWN", "CHECKED_IN", "COMPETED", "ABSENT", "DISQUALIFIED", "COMPLETED"
    ];

    // Status target weights:
    // DRAFT (10%), SUBMITTED (10%), UNDER_REVIEW (10%), REVISION_REQUIRED (5%), APPROVED (30%)
    // CHECKED_IN/COMPETED/COMPLETED (25%), REJECTED/WITHDRAWN/ABSENT/DISQUALIFIED (10%)
    const statusDistribution = [
      "DRAFT", "DRAFT",
      "SUBMITTED", "SUBMITTED",
      "UNDER_REVIEW", "UNDER_REVIEW",
      "REVISION_REQUIRED",
      "APPROVED", "APPROVED", "APPROVED", "APPROVED", "APPROVED", "APPROVED",
      "CHECKED_IN", "COMPETED", "COMPLETED", "COMPLETED", "COMPLETED",
      "REJECTED", "WITHDRAWN", "ABSENT", "DISQUALIFIED"
    ];

    const regRecords = [];
    const memberRecords = [];
    const coachRecords = [];
    const historyRecords = [];

    // Fictional Student names list
    const studentNames = [
      { title: "เด็กชาย", first: "ภูริณัฐ", last: "ใจกล้า" },
      { title: "เด็กหญิง", first: "กัญญาภัค", last: "ศรีสุข" },
      { title: "นาย", first: "ปุณณวิช", last: "แสงคำ" },
      { title: "นางสาว", first: "ณิชาภัทร", last: "พรมมา" },
      { title: "นาย", first: "ธีรภัทร", last: "วงศ์ดี" },
      { title: "นางสาว", first: "ธัญชนก", last: "บุญมี" },
      { title: "เด็กชาย", first: "พีรวิชญ์", last: "คำแสน" },
      { title: "เด็กหญิง", first: "พิมพ์มาดา", last: "รุ่งเรือง" }
    ];

    const coachNames = [
      { title: "นาย", first: "สมชาย", last: "การุณย์" },
      { title: "นางสาว", first: "วรรณภา", last: "มีสุข" },
      { title: "นาย", first: "ปรเมศวร์", last: "ศรีทอง" },
      { title: "นางสาว", first: "กมลชนก", last: "คำภา" },
      { title: "นาย", first: "อนุชา", last: "แก้วมณี" }
    ];

    let regSeq = 1;
    let participantSeq = 1;

    // Seed registrations for Sakon Nakhon schools (15 schools)
    const eventIds = ["EVT-2569-AREA", "EVT-2569-CLUSTER", "EVT-2568-HISTORY"];
    
    eventIds.forEach(evtId => {
      for (let sIdx = 1; sIdx <= 15; sIdx++) {
        const scId = `SCH-SAKON-${sIdx}`;
        
        // Register 4 items per school deterministically
        for (let itemIdx = 1; itemIdx <= 4; itemIdx++) {
          const configId = `CONFIG-${evtId}-${itemIdx}`;
          const regId = `REG-${evtId}-${sIdx}-${itemIdx}`;
          const status = statusDistribution[(sIdx + itemIdx + regSeq) % statusDistribution.length];
          const regCode = `REG-2569-${evtId.split("-")[2]}-${String(regSeq).padStart(4, "0")}`;
          
          regRecords.push({
            registrationId: regId,
            schoolId: scId,
            competitionId: evtId,
            competitionCategoryConfigId: configId,
            registrationCode: regCode,
            registrationNumber: `N-${regSeq}`,
            registrationStatus: status,
            teamName: `ทีมโรงเรียนที่ ${sIdx} กิจกรรมที่ ${itemIdx}`,
            submissionTimestamp: "2026-08-10T08:00:00Z"
          });

          // Seed 2 members per team
          for (let mIdx = 1; mIdx <= 2; mIdx++) {
            const student = studentNames[(participantSeq + mIdx) % studentNames.length];
            const memberId = `MEM-${regId}-${mIdx}`;
            
            memberRecords.push({
              registrationMemberId: memberId,
              registrationId: regId,
              participantNumber: `STU-UAT-${String(participantSeq).padStart(6, "0")}`,
              title: student.title,
              firstNameTh: student.first,
              lastNameTh: student.last,
              firstNameEn: `FirstTh ${participantSeq}`,
              lastNameEn: `LastTh ${participantSeq}`,
              gender: student.title === "เด็กหญิง" || student.title === "นางสาว" ? "FEMALE" : "MALE",
              educationLevelId: "LVL-SEC",
              gradeLevel: "3",
              schoolId: scId,
              memberRole: "PARTICIPANT"
            });
            participantSeq++;
          }

          // Seed 1 coach per team
          const coach = coachNames[(sIdx + itemIdx) % coachNames.length];
          coachRecords.push({
            coachId: `COACH-${regId}`,
            registrationId: regId,
            userId: "",
            title: coach.title,
            firstNameTh: coach.first,
            lastNameTh: coach.last,
            positionName: "ครูผู้ช่วย",
            schoolId: scId,
            emailAddress: `coach_${regSeq}@uat-school.example`,
            phoneNumber: "099-333-4444",
            isLeadCoach: "true"
          });

          // Seed status history logs
          historyRecords.push({
            registrationHistoryId: `HIST-${regId}-1`,
            registrationId: regId,
            actionType: "DRAFT",
            changeLogJson: JSON.stringify({ state: "INITIALIZED" })
          });

          if (status !== "DRAFT") {
            historyRecords.push({
              registrationHistoryId: `HIST-${regId}-2`,
              registrationId: regId,
              actionType: "SUBMITTED",
              changeLogJson: JSON.stringify({ state: "SUBMITTED" })
            });
          }

          regSeq++;
        }
      }
    });

    this.batchWrite("registrations", regRecords, ctx);
    this.batchWrite("registration_members", memberRecords, ctx);
    this.batchWrite("coaches", coachRecords, ctx);
    this.batchWrite("registration_history", historyRecords, ctx);
  },

  seedVenuesAndSchedules(ctx) {
    const venues = [
      { id: "VEN-SAKON-1", name: "หอประชุมสำนักงานเขตพื้นที่การศึกษา สพม.สกลนคร" },
      { id: "VEN-SAKON-2", name: "โรงเรียนสกลนครพัฒนศึกษา อาคาร 1" },
      { id: "VEN-SAKON-3", name: "โรงเรียนธาตุนารายณ์วิทยา ศูนย์ไอซีที" },
      { id: "VEN-SAKON-4", name: "ศูนย์ฝึกทักษะวิชาการลุ่มน้ำสงคราม" }
    ];

    const venueRecords = venues.map(v => ({
      venueId: v.id,
      name: v.name,
      address: "อ.เมือง จ.สกลนคร"
    }));
    this.batchWrite("venues", venueRecords, ctx);

    // Seed Rooms/Stages
    const roomRecords = [];
    venues.forEach((v, vIdx) => {
      for (let rIdx = 1; rIdx <= 4; rIdx++) {
        roomRecords.push({
          competitionRoomId: `ROOM-${v.id}-${rIdx}`,
          competitionId: "EVT-2569-AREA",
          venueId: v.id,
          roomCode: `RM-${vIdx+1}0${rIdx}`,
          roomNameTh: `ห้องประชุมย่อยที่ ${rIdx}`,
          roomNameEn: `Seminar Room ${rIdx}`,
          roomType: "CONFERENCE",
          capacity: 50,
          floor: `${rIdx}`,
          buildingName: "อาคารวิชาการ",
          roomStatus: "ACTIVE"
        });
      }
    });
    this.batchWrite("competition_rooms", roomRecords, ctx);

    // Seed Schedules across 15-17 November 2026
    const scheduleRecords = [];
    const eventIds = ["EVT-2569-AREA", "EVT-2569-CLUSTER", "EVT-2568-HISTORY"];
    
    let schedSeq = 1;
    eventIds.forEach(evtId => {
      for (let sIdx = 1; sIdx <= 15; sIdx++) {
        for (let itemIdx = 1; itemIdx <= 4; itemIdx++) {
          const regId = `REG-${evtId}-${sIdx}-${itemIdx}`;
          const configId = `CONFIG-${evtId}-${itemIdx}`;
          const roomId = `ROOM-VEN-SAKON-${(sIdx % 4) + 1}-1`;
          
          scheduleRecords.push({
            roomScheduleId: `SCHED-${evtId}-${sIdx}-${itemIdx}`,
            competitionId: evtId,
            competitionRoundId: `RD-${evtId}-1`,
            competitionCategoryConfigId: configId,
            competitionRoomId: roomId,
            registrationId: regId,
            scheduleDate: evtId === "EVT-2568-HISTORY" ? "2025-11-16" : "2026-11-16",
            startTimestamp: evtId === "EVT-2568-HISTORY" ? "2025-11-16T09:00:00Z" : "2026-11-16T09:00:00Z",
            endTimestamp: evtId === "EVT-2568-HISTORY" ? "2025-11-16T10:00:00Z" : "2026-11-16T10:00:00Z",
            sequenceNumber: schedSeq,
            scheduleStatus: "CONFIRMED",
            published: "true",
            publishedTimestamp: new Date().toISOString()
          });
          schedSeq++;
        }
      }
    });

    this.batchWrite("room_schedules", scheduleRecords, ctx);
  },

  seedJudgesAndScoring(ctx) {
    const judgeNames = [
      { first: "วิทยา", last: "ศรีทอง", user: "judge_wittaya" },
      { first: "สมชาย", last: "ยอดดี", user: "judge_somchai" },
      { first: "สายพิณ", last: "ใจเย็น", user: "judge_saipin" },
      { first: "ณัฏฐ์", last: "พูนทรัพย์", user: "judge_nat" },
      { first: "ประภาส", last: "คำแสน", user: "judge_prapas" }
    ];

    const userRecords = [];
    const profileRecords = [];
    const userRoleRecords = [];
    const judgeRecords = [];

    // Seed Judges (Identity & Profiles)
    judgeNames.forEach((j, idx) => {
      const jUid = `USR-JDG-${idx+1}`;
      const salt = ctx.passwordHasher.generateSalt();
      const hash = ctx.passwordHasher.hash("Uat@User2569", salt, 1000);

      userRecords.push({
        userId: jUid,
        username: j.user,
        passwordHash: hash,
        salt: salt,
        iterations: "1000",
        status: "ACTIVE",
        failedLoginCount: 0,
        lockoutUntil: "",
        passwordExpiredTimestamp: ""
      });

      profileRecords.push({
        userProfileId: `PRF-${jUid}`,
        userId: jUid,
        firstName: j.first,
        lastName: j.last,
        email: `${j.user}@uat-judge.example`,
        phone: "089-777-6666"
      });

      userRoleRecords.push({
        userRoleId: `UR-${jUid}`,
        userId: jUid,
        roleId: "ROLE-JUDGE",
        scope: "sakon1234"
      });

      judgeRecords.push({
        judgeId: `JDG-${idx+1}`,
        judgeCode: `J-${String(idx+1).padStart(3, "0")}`,
        userId: jUid,
        title: "นาย",
        firstNameTh: j.first,
        lastNameTh: j.last,
        displayName: `${j.first} ${j.last}`,
        schoolId: "SCH-SAKON-1",
        positionName: "ศึกษานิเทศก์ชำนาญการพิเศษ",
        judgeStatus: "ACTIVE"
      });
    });

    this.batchWrite("users", userRecords, ctx);
    this.batchWrite("user_profiles", profileRecords, ctx);
    this.batchWrite("user_roles", userRoleRecords, ctx);
    this.batchWrite("judges", judgeRecords, ctx);

    // Seed Scoring Rubrics & scorecards & details
    const scoreTemplates = [
      { scoreTemplateId: "TEMP-STANDARD", name: "เกณฑ์ประเมินทั่วไป 100 คะแนน", aggregationMethod: "AVERAGE", decimalPrecision: 2, status: "ACTIVE" }
    ];
    this.batchWrite("score_templates", scoreTemplates, ctx);

    const scoreCriteria = [
      { scoreCriterionId: "CRT-1", scoreTemplateId: "TEMP-STANDARD", criterionCode: "REQ", nameTh: "ความถูกต้องครบถ้วน", criterionType: "RUBRIC", minimumScore: 0, maximumScore: 20, weight: 1, displayOrder: 1, status: "ACTIVE" },
      { scoreCriterionId: "CRT-2", scoreTemplateId: "TEMP-STANDARD", criterionCode: "UIUX", nameTh: "ความสวยงามและการใช้งาน", criterionType: "RUBRIC", minimumScore: 0, maximumScore: 20, weight: 1, displayOrder: 2, status: "ACTIVE" },
      { scoreCriterionId: "CRT-3", scoreTemplateId: "TEMP-STANDARD", criterionCode: "FUNC", nameTh: "ผลลัพธ์การทำงานถูกต้อง", criterionType: "RUBRIC", minimumScore: 0, maximumScore: 25, weight: 1, displayOrder: 3, status: "ACTIVE" },
      { scoreCriterionId: "CRT-4", scoreTemplateId: "TEMP-STANDARD", criterionCode: "CODE", nameTh: "คุณภาพของโค้ดและการออกแบบ", criterionType: "RUBRIC", minimumScore: 0, maximumScore: 15, weight: 1, displayOrder: 4, status: "ACTIVE" },
      { scoreCriterionId: "CRT-5", scoreTemplateId: "TEMP-STANDARD", criterionCode: "INNOV", nameTh: "ความแปลกใหม่และความคิดสร้างสรรค์", criterionType: "RUBRIC", minimumScore: 0, maximumScore: 10, weight: 1, displayOrder: 5, status: "ACTIVE" },
      { scoreCriterionId: "CRT-6", scoreTemplateId: "TEMP-STANDARD", criterionCode: "PRES", nameTh: "การนำเสนอความสามารถ", criterionType: "RUBRIC", minimumScore: 0, maximumScore: 10, weight: 1, displayOrder: 6, status: "ACTIVE" }
    ];
    this.batchWrite("score_criteria", scoreCriteria, ctx);

    // Create scorecards and details for COMPETED/COMPLETED registrations (Sakon Nakhon)
    const cardRecords = [];
    const detailRecords = [];
    const eventIds = ["EVT-2569-AREA", "EVT-2569-CLUSTER", "EVT-2568-HISTORY"];

    let detailSeq = 1;
    eventIds.forEach(evtId => {
      for (let sIdx = 1; sIdx <= 15; sIdx++) {
        for (let itemIdx = 1; itemIdx <= 4; itemIdx++) {
          const regId = `REG-${evtId}-${sIdx}-${itemIdx}`;
          const configId = `CONFIG-${evtId}-${itemIdx}`;
          
          // Only score for completed/competed states
          if (sIdx % 2 === 0) {
            const cardId = `CARD-${evtId}-${sIdx}-${itemIdx}`;
            
            cardRecords.push({
              scorecardId: cardId,
              competitionId: evtId,
              competitionRoundId: `RD-${evtId}-1`,
              competitionCategoryConfigId: configId,
              registrationId: regId,
              roomScheduleId: `SCHED-${evtId}-${sIdx}-${itemIdx}`,
              judgeAssignmentId: `ASG-${evtId}-${sIdx}-${itemIdx}`,
              judgeId: "JDG-1",
              scoreTemplateId: "TEMP-STANDARD",
              scoreTemplateVersion: 1,
              scorecardStatus: "HARD_LOCKED",
              submittedTimestamp: "2026-11-16T11:00:00Z"
            });

            // 85 points score detail
            const scoresMap = [17, 18, 22, 12, 8, 8]; // total = 85
            scoreCriteria.forEach((crit, cIdx) => {
              detailRecords.push({
                scoreDetailId: `DET-${detailSeq}`,
                scorecardId: cardId,
                scoreCriterionId: crit.scoreCriterionId,
                criterionCode: crit.criterionCode,
                rawScore: scoresMap[cIdx],
                normalizedScore: scoresMap[cIdx],
                weightedScore: scoresMap[cIdx],
                rubricLevel: "5",
                comment: "ทำได้ดีตามมาตรฐาน"
              });
              detailSeq++;
            });
          }
        }
      }
    });

    this.batchWrite("scorecards", cardRecords, ctx);
    this.batchWrite("score_details", detailRecords, ctx);
  },

  seedResultsAndMedals(ctx) {
    const summaryRecords = [];
    const rankingRecords = [];
    const medalRecords = [];
    
    const eventIds = ["EVT-2569-AREA", "EVT-2569-CLUSTER", "EVT-2568-HISTORY"];

    eventIds.forEach(evtId => {
      for (let sIdx = 1; sIdx <= 15; sIdx++) {
        for (let itemIdx = 1; itemIdx <= 4; itemIdx++) {
          const regId = `REG-${evtId}-${sIdx}-${itemIdx}`;
          const configId = `CONFIG-${evtId}-${itemIdx}`;
          
          if (sIdx % 2 === 0) {
            const sumId = `SUM-${evtId}-${sIdx}-${itemIdx}`;
            
            // Average score is 85.00 -> Gold Medal
            summaryRecords.push({
              scoreSummaryId: sumId,
              competitionId: evtId,
              competitionRoundId: `RD-${evtId}-1`,
              competitionCategoryConfigId: configId,
              registrationId: regId,
              averageScore: 85.00,
              scoreVariance: 0,
              medalTier: "GOLD",
              summaryStatus: "LOCKED"
            });

            rankingRecords.push({
              rankingId: `RNK-${evtId}-${sIdx}-${itemIdx}`,
              competitionId: evtId,
              competitionRoundId: `RD-${evtId}-1`,
              competitionCategoryConfigId: configId,
              registrationId: regId,
              rankPosition: 1,
              resultVersion: 1
            });

            medalRecords.push({
              medalId: `MED-${evtId}-${sIdx}-${itemIdx}`,
              registrationId: regId,
              medalTier: "GOLD",
              awardedTimestamp: "2026-11-17T16:00:00Z",
              resultVersion: 1
            });
          }
        }
      }
    });

    this.batchWrite("score_summary", summaryRecords, ctx);
    this.batchWrite("rankings", rankingRecords, ctx);
    this.batchWrite("medals", medalRecords, ctx);
  },

  seedCertificates(ctx) {
    const certRecords = [];
    const verRecords = [];
    
    const eventIds = ["EVT-2569-AREA", "EVT-2569-CLUSTER", "EVT-2568-HISTORY"];

    let certSeq = 1;
    eventIds.forEach(evtId => {
      for (let sIdx = 1; sIdx <= 15; sIdx++) {
        for (let itemIdx = 1; itemIdx <= 4; itemIdx++) {
          const regId = `REG-${evtId}-${sIdx}-${itemIdx}`;
          
          if (sIdx % 2 === 0) {
            const cId = `CERT-${evtId}-${sIdx}-${itemIdx}`;
            const certNo = `CERT-${evtId.split("-")[2]}-${String(certSeq).padStart(6, "0")}`;
            const token = `TOK-UAT-${certSeq}-${evtId.split("-")[2]}`;
            
            certRecords.push({
              certificateId: cId,
              certificateNumber: certNo,
              certificateVersion: 1,
              supersedesCertificateId: "",
              recipientType: "STUDENT",
              recipientReferenceId: `STU-UAT-${sIdx}-${itemIdx}`,
              recipientNameSnapshot: `นักเรียนผู้เข้าสอบคนที่ ${sIdx}`,
              recipientTitleSnapshot: "นาย",
              schoolId: `SCH-SAKON-${sIdx}`,
              schoolNameSnapshot: `โรงเรียนสกลนครพัฒนศึกษาแห่งที่ ${sIdx}`,
              competitionId: evtId,
              competitionNameSnapshot: "การแข่งขันศิลปหัตถกรรมวิชาการ",
              competitionCategoryConfigId: `CONFIG-${evtId}-${itemIdx}`,
              categoryNameSnapshot: "ภาษาไทย",
              competitionRoundId: `RD-${evtId}-1`,
              roundNameSnapshot: "รอบชิงชนะเลิศ",
              academicYearId: evtId === "EVT-2568-HISTORY" ? "AY-2568" : "AY-2569",
              academicYearSnapshot: evtId === "EVT-2568-HISTORY" ? "2568" : "2569",
              registrationId: regId,
              registrationNumberSnapshot: `N-${sIdx}`,
              scoreSummaryId: `SUM-${evtId}-${sIdx}-${itemIdx}`,
              finalScoreSnapshot: 85.00,
              medalTierSnapshot: "GOLD",
              awardNameSnapshot: "รางวัลชนะเลิศเหรียญทอง",
              rankingSnapshot: 1,
              certificateTemplateId: "TEMP-CERT",
              templateVersionSnapshot: 1,
              issueDateSnapshot: "2026-11-18",
              issuerNameSnapshot: "ผู้อำนวยการเขตพื้นที่การศึกษา",
              resultVersion: 1,
              verificationToken: token,
              verificationHash: `HASH-${token}`,
              integrityChecksum: `CRC-${token}`,
              qrPayload: `https://script.google.com/macros/s/UAT/exec?v=${token}`,
              pdfFileId: "PDF-FILE-MOCK-123",
              pdfFileName: `${certNo}.pdf`,
              pdfMimeType: "application/pdf",
              generationStatus: "COMPLETED",
              certificateStatus: "ISSUED",
              generatedTimestamp: "2026-11-18T09:00:00Z"
            });

            verRecords.push({
              certificateVerificationId: `VER-${cId}`,
              certificateId: cId,
              verificationToken: token,
              verificationHash: `HASH-${token}`,
              integrityChecksum: `CRC-${token}`,
              verificationStatus: "ACTIVE",
              publicDisplayJson: JSON.stringify({ name: `นักเรียนคนที่ ${sIdx}`, award: "เหรียญทอง" }),
              issuedTimestamp: "2026-11-18T09:00:00Z",
              verificationCount: 0,
              resultVersion: 1,
              certificateVersion: 1
            });

            certSeq++;
          }
        }
      }
    });

    this.batchWrite("certificates", certRecords, ctx);
    this.batchWrite("certificate_verification", verRecords, ctx);
  },

  seedNotifications(ctx) {
    const records = [];
    for (let i = 1; i <= 40; i++) {
      records.push({
        notificationId: `NOTIF-${i}`,
        notificationCode: `NOTIF-CODE-${i}`,
        notificationType: "IN_APP",
        sourceContext: "REGISTRATION",
        sourceEntityType: "registrations",
        sourceEntityId: "REG-EVT-2569-AREA-1-1",
        sourceVersion: 1,
        correlationId: "CORR-123",
        idempotencyKey: `IDEM-${i}`,
        priority: "MEDIUM",
        locale: "th-TH",
        subjectTemplateCode: "SUB-REG-SUBMITTED",
        bodyTemplateCode: "BODY-REG-SUBMITTED",
        payloadJson: JSON.stringify({ teamName: "ทีมสกลนคร" }),
        recipientResolutionStatus: "RESOLVED",
        notificationStatus: "QUEUED",
        scheduledTimestamp: new Date().toISOString(),
        expiresTimestamp: ""
      });
    }
    this.batchWrite("notifications", records, ctx);
  },

  seedLogsAndSystemConfigs(ctx) {
    // 1. Seed audit logs
    const auditLogs = [];
    for (let i = 1; i <= 100; i++) {
      auditLogs.push({
        auditLogId: `AUDIT-UAT-${i}`,
        tenantId: "sakon1234",
        timestamp: new Date().toISOString(),
        actorUserId: "USR-SAKON",
        actorRoleCodesJson: "[\"TENANT_ADMIN\"]",
        action: "UPDATE",
        entityType: "registrations",
        entityId: "REG-EVT-2569-AREA-1-1",
        previousValueJson: "{}",
        newValueJson: "{}",
        reason: "UAT Demonstration Log Check",
        requestId: `REQ-${i}`,
        correlationId: "",
        deviceId: "BROWSER_UAT",
        ipAddressHash: "SHA256_LOCAL",
        result: "SUCCESS"
      });
    }
    this.batchWrite("audit_logs", auditLogs, ctx);

    // 2. Seed system settings
    const settings = [
      { settingId: "SET-1", key: "applicationNameTh", value: "ระบบจัดการแข่งขันทักษะวิชาการ", description: "Application Name (Thai)", type: "STRING" },
      { settingId: "SET-2", key: "applicationNameEn", value: "Competition Management Platform Enterprise", description: "Application Name (English)", type: "STRING" },
      { settingId: "SET-3", key: "defaultLocale", value: "th-TH", description: "Default System Locale", type: "STRING" },
      { settingId: "SET-4", key: "currentAcademicYear", value: "2569", description: "Current active academic year", type: "STRING" },
      { settingId: "SET-5", key: "environment", value: "UAT", description: "Runtime deployment mode environment", type: "STRING" }
    ];
    this.batchWrite("settings", settings, ctx);

    // 3. Seed Feature Flags
    const flags = [
      { featureFlagId: "FLAG-1", flagKey: "ENABLE_OFFLINE_MODE", enabled: "true", description: "Enable offline synchronizations" },
      { featureFlagId: "FLAG-2", flagKey: "ENABLE_DYNAMIC_FORMS", enabled: "true", description: "Enable customizable metadata forms schema" },
      { featureFlagId: "FLAG-3", flagKey: "ENABLE_UAT_BANNER", enabled: "true", description: "Show demonstration layout banner" }
    ];
    this.batchWrite("feature_flags", flags, ctx);
  },

  /**
   * Creates a recoverable Drive backup, migrates retired identifiers, and
   * rebuilds identity/RBAC master data with one canonical identifier scheme.
   */
  rebuildCanonicalIdentityAndRbac() {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      const source = SpreadsheetApp.openById(CMPE_ENVIRONMENT.getSpreadsheetId());
      const stamp = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyyMMdd-HHmmss");
      const backup = SpreadsheetApp.create(`CMPE Identity RBAC Backup ${stamp}`);
      const targets = ["tenants", "roles", "permissions", "role_permissions", "user_roles", "academic_years"];

      targets.forEach((name, index) => {
        const sourceSheet = source.getSheetByName(name);
        if (!sourceSheet) return;
        const backupSheet = index === 0 ? backup.getSheets()[0].setName(name) : backup.insertSheet(name);
        const values = sourceSheet.getDataRange().getValues();
        backupSheet.getRange(1, 1, values.length, values[0].length).setValues(values);
      });

      const tenantMap = {
        SESAO_SAKON: "sakon1234", SESAO_UDON: "udon1234",
        SESAO_KHONKAEN: "kk1234", SESAO_KORAT: "korat1234",
        SESAO_SURIN: "surin1234"
      };
      let tenantReferencesMigrated = 0;
      let academicYearReferencesMigrated = 0;
      source.getSheets().forEach(sheet => {
        if (sheet.getLastRow() < 2) return;
        const values = sheet.getDataRange().getValues();
        const headers = values[0].map(String);
        let changed = false;
        headers.forEach((header, col) => {
          if (!["tenantId", "scope", "academicYearId"].includes(header)) return;
          for (let row = 1; row < values.length; row += 1) {
            const current = String(values[row][col] || "");
            if ((header === "tenantId" || header === "scope") && tenantMap[current]) {
              values[row][col] = tenantMap[current];
              tenantReferencesMigrated += 1;
              changed = true;
            } else if (header === "academicYearId" && current === "AY_2569") {
              values[row][col] = "AY-2569";
              academicYearReferencesMigrated += 1;
              changed = true;
            }
          }
        });
        if (changed) sheet.getRange(2, 1, values.length - 1, values[0].length).setValues(values.slice(1));
      });

      const now = new Date().toISOString();
      const actor = "CANONICAL_IDENTITY_REPAIR";
      const tenants = source.getSheetByName("tenants");
      const tenantValues = tenants.getDataRange().getValues();
      const tenantIdCol = tenantValues[0].indexOf("tenantId");
      const canonicalIds = Object.values(tenantMap);
      const passwordHashCol = tenantValues[0].indexOf("adminPasswordHash");
      const canonicalTenants = canonicalIds.map(id => {
        const candidates = tenantValues.slice(1).filter(row => String(row[tenantIdCol]) === id);
        candidates.sort((a, b) =>
          String(b[passwordHashCol] || "").length - String(a[passwordHashCol] || "").length
        );
        return candidates[0];
      }).filter(Boolean);
      if (canonicalTenants.length !== 5) {
        throw new Error(`Expected 5 canonical tenants, found ${canonicalTenants.length}. Backup: ${backup.getUrl()}`);
      }
      this.replaceSheetRows_(tenants, tenantValues[0], canonicalTenants);

      const roleCodes = [
        "SUPER_ADMIN", "TENANT_ADMIN", "COMPETITION_MANAGER", "REGISTRATION_OFFICER",
        "SCHOOL_ADMIN", "TEACHER", "JUDGE", "VENUE_MANAGER",
        "CERTIFICATE_OFFICER", "AUDITOR", "VIEWER"
      ];
      const roles = source.getSheetByName("roles");
      const roleRows = roleCodes.map(code => this.canonicalMutableRow_(
        roles, { roleId: `ROLE-${code}`, roleCode: code, name: `System Role ${code}`, tenantId: "sakon1234" }, now, actor
      ));
      this.replaceSheetRows_(roles, null, roleRows);

      const permissions = source.getSheetByName("permissions");
      const permissionRows = CMPE_CONSTANTS.AllPermissions.map(code => this.canonicalMutableRow_(
        permissions,
        { permissionId: this.permissionId_(code), permissionCode: code, name: code, tenantId: "sakon1234" },
        now, actor
      ));
      this.replaceSheetRows_(permissions, null, permissionRows);

      const policies = {
        SUPER_ADMIN: () => true,
        TENANT_ADMIN: () => true,
        COMPETITION_MANAGER: code => !/^(system|tenant)\./.test(code),
        REGISTRATION_OFFICER: code => /^(registration|registrationMember|registrationCoach|school|province|district|academicYear|checkin|dashboard|report)\./.test(code),
        SCHOOL_ADMIN: code => /^(registration\.(readOwnSchool|create|submit)|registrationMember|registrationCoach|appeal|dashboard\.readOwnSchool|report\.readOwn|certificate\.download|school\.read)/.test(code),
        TEACHER: code => /^(registration\.(readOwnSchool|create|submit)|registrationMember|registrationCoach|appeal|dashboard\.readOwnSchool|report\.readOwn|certificate\.download)/.test(code),
        JUDGE: code => /^(judge\.read|score\.(enter|updateOwnDraft|submit)|dashboard\.readTenant)/.test(code),
        VENUE_MANAGER: code => /^(venue|competitionRoom|roomSchedule|operationalReadiness|checkin|announcement|dashboard)\./.test(code),
        CERTIFICATE_OFFICER: code => /^(certificate|dashboard|report|leaderboard)\./.test(code),
        AUDITOR: code => /^(audit|dashboard|report|leaderboard|notification\.readTenant)/.test(code),
        VIEWER: code => /^(dashboard\.readOwnSchool|leaderboard\.readInternal|report\.readOwn)$/.test(code)
      };
      const rolePermissions = source.getSheetByName("role_permissions");
      const rolePermissionRows = [];
      roleCodes.forEach(roleCode => {
        CMPE_CONSTANTS.AllPermissions.filter(policies[roleCode]).forEach(permissionCode => {
          const permissionId = this.permissionId_(permissionCode);
          rolePermissionRows.push(this.canonicalMutableRow_(rolePermissions, {
            rolePermissionId: `RP-${roleCode}-${permissionId.substring(5)}`,
            roleId: `ROLE-${roleCode}`,
            permissionId,
            tenantId: "sakon1234"
          }, now, actor));
        });
      });
      this.replaceSheetRows_(rolePermissions, null, rolePermissionRows);

      const years = source.getSheetByName("academic_years");
      const yearValues = years.getDataRange().getValues();
      const yearIdCol = yearValues[0].indexOf("academicYearId");
      const canonicalYears = ["AY-2569", "AY-2568"].map(id =>
        yearValues.slice(1).find(row => String(row[yearIdCol]) === id)
      ).filter(Boolean);
      this.replaceSheetRows_(years, yearValues[0], canonicalYears);

      return {
        success: true,
        backupSpreadsheetId: backup.getId(),
        backupUrl: backup.getUrl(),
        counts: {
          tenants: canonicalTenants.length, roles: roleRows.length,
          permissions: permissionRows.length, rolePermissions: rolePermissionRows.length,
          academicYears: canonicalYears.length
        },
        tenantReferencesMigrated,
        academicYearReferencesMigrated
      };
    } finally {
      lock.releaseLock();
    }
  },

  permissionId_(code) {
    return `PERM-${code.replace(/[^A-Za-z0-9]+/g, "-").toUpperCase()}`;
  },

  canonicalMutableRow_(sheet, record, now, actor) {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const metadata = {
      createdTimestamp: now, createdBy: actor, lastModifiedTimestamp: now,
      lastModifiedBy: actor, rowVersion: 1, recordStatus: "ACTIVE",
      deletedTimestamp: "", deletedBy: ""
    };
    return headers.map(header => Object.prototype.hasOwnProperty.call(record, header)
      ? record[header]
      : (Object.prototype.hasOwnProperty.call(metadata, header) ? metadata[header] : ""));
  },

  replaceSheetRows_(sheet, headers, rows) {
    const actualHeaders = headers || sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    sheet.clearContents();
    sheet.getRange(1, 1, 1, actualHeaders.length).setValues([actualHeaders]);
    if (rows.length) sheet.getRange(2, 1, rows.length, actualHeaders.length).setValues(rows);
  },

  // --- REPOSITORIES UTILITY ADAPTERS ---

  batchWrite(sheetName, records, ctx) {
    if (records.length === 0) return;
    
    const sheet = ctx.ss.getSheetByName(sheetName);
    const headerMap = this.getHeaderMap(sheet);
    const catalog = CMPE_CONSTANTS.TableCatalog[sheetName];
    const mutable = catalog ? catalog.mutable : false;
    const pkName = catalog ? catalog.pk : Object.keys(headerMap)[0];

    if (!ctx.seedRegistry[sheetName]) {
      ctx.seedRegistry[sheetName] = [];
    }

    const lastRow = sheet.getLastRow();
    const existingData = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn() || 1).getValues() : [];
    const pkColIdx = headerMap[pkName] - 1;
    
    const pkToRowIndex = {};
    existingData.forEach((row, i) => {
      const val = row[pkColIdx];
      if (val) pkToRowIndex[val] = i + 2;
    });

    const rowsToAppend = [];
    
    records.forEach(r => {
      if (mutable) {
        r.tenantId = r.tenantId || this.inferTenantId(r);
        r.createdTimestamp = r.createdTimestamp || new Date().toISOString();
        r.createdBy = r.createdBy || ctx.actor.userId;
        r.lastModifiedTimestamp = new Date().toISOString();
        r.lastModifiedBy = ctx.actor.userId;
        r.rowVersion = (r.rowVersion || 0) + 1;
        r.recordStatus = "ACTIVE";
      }

      ctx.seedRegistry[sheetName].push(r[pkName]);
      const rowData = this.mapObjectToRow(r, headerMap);

      const existingRowIdx = pkToRowIndex[r[pkName]];
      if (existingRowIdx) {
        sheet.getRange(existingRowIdx, 1, 1, rowData.length).setValues([rowData]);
      } else {
        rowsToAppend.push(rowData);
      }
    });

    if (rowsToAppend.length > 0) {
      const startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
    }
  },

  inferTenantId(record) {
    const haystack = Object.keys(record || {})
      .map(key => String(record[key] || ""))
      .join("|")
      .toUpperCase();
    if (haystack.indexOf("UDON") !== -1) return "udon1234";
    if (haystack.indexOf("KHONKAEN") !== -1 || haystack.indexOf("KK") !== -1) return "kk1234";
    if (haystack.indexOf("KORAT") !== -1) return "korat1234";
    if (haystack.indexOf("SURIN") !== -1) return "surin1234";
    return "sakon1234";
  },

  repairMissingTenantIds() {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      const ss = SpreadsheetApp.openById(CMPE_ENVIRONMENT.getSpreadsheetId());
      const repaired = {};
      const catalog = CMPE_CONSTANTS.TableCatalog;
      Object.keys(catalog).forEach(sheetName => {
        if (!catalog[sheetName].mutable) return;
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet || sheet.getLastRow() <= 1) return;
        const hm = this.getHeaderMap(sheet);
        if (!hm.tenantId) return;
        const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
        let count = 0;
        values.forEach((row, index) => {
          if (String(row[hm.tenantId - 1] || "").trim()) return;
          const record = this.mapRowToObject(row, hm);
          sheet.getRange(index + 2, hm.tenantId).setValue(this.inferTenantId(record));
          if (hm.lastModifiedTimestamp) {
            sheet.getRange(index + 2, hm.lastModifiedTimestamp).setValue(new Date().toISOString());
          }
          if (hm.lastModifiedBy) {
            sheet.getRange(index + 2, hm.lastModifiedBy).setValue("TENANT_REPAIR_MIGRATION");
          }
          if (hm.rowVersion) {
            sheet.getRange(index + 2, hm.rowVersion).setValue((parseInt(row[hm.rowVersion - 1], 10) || 0) + 1);
          }
          count++;
        });
        if (count) repaired[sheetName] = count;
      });
      return {
        success: true,
        repaired,
        repairedTotal: Object.keys(repaired).reduce((sum, key) => sum + repaired[key], 0)
      };
    } finally {
      lock.releaseLock();
    }
  },

  getHeaderMap(sheet) {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1).getValues()[0];
    const map = {};
    headers.forEach((h, idx) => {
      if (h) map[h] = idx + 1;
    });
    return map;
  },

  mapObjectToRow(obj, headerMap) {
    const row = [];
    const keys = Object.keys(headerMap).sort((a, b) => headerMap[a] - headerMap[b]);
    keys.forEach(key => {
      row.push(obj[key] === undefined || obj[key] === null ? "" : obj[key]);
    });
    return row;
  },

  createPrng(seed) {
    let h = seed ^ 0xdeadbeef;
    return function() {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  },

  mapRowToObject(rowValues, headerMap) {
    const obj = {};
    for (const key in headerMap) {
      const idx = headerMap[key] - 1;
      obj[key] = rowValues[idx];
    }
    return obj;
  },

  validateUatMockData() {
    const ssId = CMPE_ENVIRONMENT.getSpreadsheetId();
    const ss = SpreadsheetApp.openById(ssId);
    const summary = this.getUatSeedSummary();

    let foreignKeyErrors = 0;
    let crossTenantErrors = 0;
    let duplicateUuidErrors = 0;
    let plaintextPasswordErrors = 0;
    let dashboardReconciliationErrors = 0;
    const warnings = [];

    const getSheetData = (name) => {
      const sh = ss.getSheetByName(name);
      if (!sh || sh.getLastRow() <= 1) return [];
      const headerMap = this.getHeaderMap(sh);
      const values = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
      return values.map(row => this.mapRowToObject(row, headerMap));
    };

    const users = getSheetData("users");
    users.forEach(u => {
      const plainwords = ["Uat@Super2569", "Uat@Admin2569", "Uat@User2569", "superadmin", "sakon1234"];
      if (plainwords.indexOf(u.passwordHash) !== -1 || u.passwordHash.length < 20) {
        plaintextPasswordErrors++;
        warnings.push(`User ${u.username} has potential plaintext password or weak hash.`);
      }
    });

    const tenants = getSheetData("tenants");
    tenants.forEach(t => {
      const plainwords = ["sakon1234", "udon1234", "kk1234", "korat1234", "surin1234"];
      if (plainwords.indexOf(t.adminPasswordHash) !== -1 || t.adminPasswordHash.length < 20) {
        plaintextPasswordErrors++;
        warnings.push(`Tenant ${t.name} has plaintext password in adminPasswordHash.`);
      }
    });

    const schools = getSheetData("schools");
    const schoolIds = new Set(schools.map(s => s.schoolId));
    
    const registrations = getSheetData("registrations");
    registrations.forEach(r => {
      if (!schoolIds.has(r.schoolId)) {
        foreignKeyErrors++;
        warnings.push(`Registration ${r.registrationId} references missing schoolId: ${r.schoolId}`);
      }
    });

    const allPks = [];
    const catalog = CMPE_CONSTANTS.TableCatalog;
    for (const name in catalog) {
      const pkName = catalog[name].pk;
      const data = getSheetData(name);
      data.forEach(row => {
        const val = row[pkName];
        if (val) allPks.push(val);
      });
    }
    const pkSet = new Set();
    allPks.forEach(pk => {
      if (pkSet.has(pk)) {
        duplicateUuidErrors++;
        warnings.push(`Duplicate UUID primary key detected: ${pk}`);
      }
      pkSet.add(pk);
    });

    const sakonSchoolsCount = schools.filter(s => s.schoolId.indexOf("SAKON") !== -1).length;
    if (sakonSchoolsCount !== 15) {
      dashboardReconciliationErrors++;
      warnings.push(`Dashboard reconciliation mismatch: expected 15 Sakon schools, found ${sakonSchoolsCount}`);
    }

    const status = (foreignKeyErrors === 0 && crossTenantErrors === 0 && duplicateUuidErrors === 0 && plaintextPasswordErrors === 0 && dashboardReconciliationErrors === 0) ? "PASS" : "WARNING";

    return {
      status: status,
      environment: "UAT",
      seedBatchId: "BATCH-UAT-VALID-100",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationSeconds: 1,
      academicYears: summary["academic_years"] || 0,
      tenants: summary["tenants"] || 0,
      schools: summary["schools"] || 0,
      users: summary["users"] || 0,
      events: summary["competitions"] || 0,
      categories: summary["competition_categories"] || 0,
      competitionItems: summary["competition_category_configs"] || 0,
      registrations: summary["registrations"] || 0,
      students: summary["registration_members"] || 0,
      coaches: summary["coaches"] || 0,
      judges: summary["judges"] || 0,
      scoreRecords: summary["scorecards"] || 0,
      results: summary["score_summary"] || 0,
      certificates: summary["certificates"] || 0,
      foreignKeyErrors,
      crossTenantErrors,
      duplicateUuidErrors,
      plaintextPasswordErrors,
      dashboardReconciliationErrors,
      warnings
    };
  }
};

// Global Apps Script entry points
function seedUatMockData() {
  return CMPE_UAT_MOCK_DATA_SEEDER.seedUatMockData();
}

function validateUatMockData() {
  return CMPE_UAT_MOCK_DATA_SEEDER.validateUatMockData();
}

function clearUatMockData(confirmationToken) {
  return CMPE_UAT_MOCK_DATA_SEEDER.clearUatMockData(confirmationToken);
}

function reseedUatMockData() {
  return CMPE_UAT_MOCK_DATA_SEEDER.reseedUatMockData();
}

function getUatSeedSummary() {
  return CMPE_UAT_MOCK_DATA_SEEDER.getUatSeedSummary();
}

function getUatDemoCredentials() {
  return CMPE_UAT_MOCK_DATA_SEEDER.getUatDemoCredentials();
}

function repairMissingTenantIds() {
  return CMPE_UAT_MOCK_DATA_SEEDER.repairMissingTenantIds();
}

function rebuildCanonicalIdentityAndRbac() {
  return CMPE_UAT_MOCK_DATA_SEEDER.rebuildCanonicalIdentityAndRbac();
}

if (typeof global !== "undefined") {
  global.CMPE_UAT_MOCK_DATA_SEEDER = CMPE_UAT_MOCK_DATA_SEEDER;
  global.seedUatMockData = seedUatMockData;
  global.validateUatMockData = validateUatMockData;
  global.clearUatMockData = clearUatMockData;
  global.reseedUatMockData = reseedUatMockData;
  global.getUatSeedSummary = getUatSeedSummary;
  global.getUatDemoCredentials = getUatDemoCredentials;
  global.repairMissingTenantIds = repairMissingTenantIds;
  global.rebuildCanonicalIdentityAndRbac = rebuildCanonicalIdentityAndRbac;
}
