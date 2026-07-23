/**
 * Competition Platform Engineering Standards (CPES)
 * Infrastructure Seed Service
 */

const CMPE_SEED_SERVICE = {
  /**
   * Seed static directories and default configurations safely.
   */
  seedAllDefaults() {
    const actorContext = { userId: "SYSTEM", tenantId: "SESAO_SAKON", roles: ["SUPER_ADMIN"] };
    
    // 1. Seed Roles
    const rolesRepo = new BaseRepository("roles");
    const rolesList = [
      { roleId: "ROLE_SUPER_ADMIN", roleCode: "SUPER_ADMIN", name: "Super Administrator" },
      { roleId: "ROLE_AREA_ADMIN", roleCode: "AREA_ADMIN", name: "Area Administrator" },
      { roleId: "ROLE_SCHOOL_ADMIN", roleCode: "SCHOOL_ADMIN", name: "School Administrator" },
      { roleId: "ROLE_SCHOOL_REGISTRAR", roleCode: "SCHOOL_REGISTRAR", name: "School Registrar" },
      { roleId: "ROLE_CHIEF_JUDGE", roleCode: "CHIEF_JUDGE", name: "Chief Judge" },
      { roleId: "ROLE_SCORE_JUDGE", roleCode: "SCORE_JUDGE", name: "Score Judge" },
      { roleId: "ROLE_AUDITOR", roleCode: "AUDITOR", name: "System Auditor" },
      { roleId: "ROLE_GUEST_VIEWER", roleCode: "GUEST_VIEWER", name: "Guest Viewer" }
    ];
    rolesList.forEach(role => {
      if (!rolesRepo.exists({ roleId: role.roleId }, null)) {
        rolesRepo.create(role, actorContext);
      }
    });

    // 2. Seed Permissions
    const permissionsRepo = new BaseRepository("permissions");
    const permissionsList = [
      { permissionId: "PERM_COMP_CONFIG", permissionCode: "competition.configure", name: "Configure Competition Category Settings" },
      { permissionId: "PERM_REG_CREATE", permissionCode: "registration.create", name: "Register School Teams" },
      { permissionId: "PERM_REG_APPROVE", permissionCode: "registration.approve", name: "Approve/Lock Registrations" },
      { permissionId: "PERM_SCORE_ENTER", permissionCode: "score.enter", name: "Enter Judge Scores" },
      { permissionId: "PERM_SCORE_VERIFY", permissionCode: "score.verify", name: "Verify Scoring Standings" },
      { permissionId: "PERM_SCORE_LOCK", permissionCode: "score.lock", name: "Hard Lock Scorecards" },
      { permissionId: "PERM_SCORE_UNLOCK", permissionCode: "score.unlock", name: "Unlock Scorecards (Overrides)" },
      { permissionId: "PERM_CERT_GEN", permissionCode: "certificate.generate", name: "Generate Verified PDF Certificates" },
      { permissionId: "PERM_AUDIT_READ", permissionCode: "audit.read", name: "View System Transaction Audit Logs" },
      { permissionId: "PERM_SETTINGS_UPDATE", permissionCode: "system.settings.update", name: "Modify Global Config Variables" }
    ];
    permissionsList.forEach(perm => {
      if (!permissionsRepo.exists({ permissionId: perm.permissionId }, null)) {
        permissionsRepo.create(perm, actorContext);
      }
    });

    // 3. Seed Role-Permissions mappings
    const rolePermsRepo = new BaseRepository("role_permissions");
    const mappings = [
      { rolePermissionId: "RP_001", roleId: "ROLE_SUPER_ADMIN", permissionId: "PERM_SETTINGS_UPDATE" },
      { rolePermissionId: "RP_002", roleId: "ROLE_SUPER_ADMIN", permissionId: "PERM_AUDIT_READ" },
      { rolePermissionId: "RP_003", roleId: "ROLE_AREA_ADMIN", permissionId: "PERM_COMP_CONFIG" },
      { rolePermissionId: "RP_004", roleId: "ROLE_AREA_ADMIN", permissionId: "PERM_REG_APPROVE" },
      { rolePermissionId: "RP_005", roleId: "ROLE_AREA_ADMIN", permissionId: "PERM_SCORE_UNLOCK" },
      { rolePermissionId: "RP_006", roleId: "ROLE_SCHOOL_REGISTRAR", permissionId: "PERM_REG_CREATE" },
      { rolePermissionId: "RP_007", roleId: "ROLE_SCHOOL_REGISTRAR", permissionId: "PERM_CERT_GEN" },
      { rolePermissionId: "RP_008", roleId: "ROLE_SCORE_JUDGE", permissionId: "PERM_SCORE_ENTER" },
      { rolePermissionId: "RP_009", roleId: "ROLE_CHIEF_JUDGE", permissionId: "PERM_SCORE_ENTER" },
      { rolePermissionId: "RP_010", roleId: "ROLE_CHIEF_JUDGE", permissionId: "PERM_SCORE_LOCK" }
    ];
    mappings.forEach(map => {
      if (!rolePermsRepo.exists({ rolePermissionId: map.rolePermissionId }, null)) {
        rolePermsRepo.create(map, actorContext);
      }
    });

    // 4. Seed Tenants
    const tenantsRepo = new BaseRepository("tenants");
    const passwordHasher = new PasswordHasher();
    const tenantsList = [
      { tenantId: "SESAO_SAKON", name: "สพม.สกลนคร (เจ้าภาพหลัก)", province: "สกลนคร", adminUsername: "admin_sakon", adminPasswordHash: passwordHasher.hash("sakon1234", "SESAO_SAKON", 1000), status: "ACTIVE" },
      { tenantId: "SESAO_UDON", name: "สพม.อุดรธานี", province: "อุดรธานี", adminUsername: "admin_udon", adminPasswordHash: passwordHasher.hash("udon1234", "SESAO_UDON", 1000), status: "ACTIVE" },
      { tenantId: "SESAO_KHONKAEN", name: "สพม.ขอนแก่น", province: "ขอนแก่น", adminUsername: "admin_kk", adminPasswordHash: passwordHasher.hash("kk1234", "SESAO_KHONKAEN", 1000), status: "ACTIVE" },
      { tenantId: "SESAO_KORAT", name: "สพม.นครราชสีมา", province: "นครราชสีมา", adminUsername: "admin_korat", adminPasswordHash: passwordHasher.hash("korat1234", "SESAO_KORAT", 1000), status: "ACTIVE" },
      { tenantId: "SESAO_SURIN", name: "สพม.สุรินทร์", province: "สุรินทร์", adminUsername: "admin_surin", adminPasswordHash: passwordHasher.hash("surin1234", "SESAO_SURIN", 1000), status: "ACTIVE" }
    ];
    tenantsList.forEach(t => {
      if (!tenantsRepo.exists({ tenantId: t.tenantId }, null)) {
        tenantsRepo.create(t, actorContext);
      } else {
        const existing = tenantsRepo.findOne({ tenantId: t.tenantId }, null);
        if (existing) {
          const pass = existing.adminPasswordHash;
          const isPlaintext = pass === "HASH_PLACEHOLDER" || pass.length < 20 || pass === "sakon1234" || pass === "udon1234" || pass === "kk1234" || pass === "korat1234" || pass === "surin1234";
          if (isPlaintext) {
            existing.adminPasswordHash = t.adminPasswordHash;
            tenantsRepo.update({ tenantId: t.tenantId }, existing, actorContext);
          }
        }
      }
    });

    // 5. Seed Academic Year
    const yearRepo = new BaseRepository("academic_years");
    if (!yearRepo.exists({ academicYearId: "AY_2569" }, null)) {
      yearRepo.create({ academicYearId: "AY_2569", yearValue: "2569", status: "ACTIVE" }, actorContext);
    }

    // 6. Seed Education Levels
    const levelsRepo = new BaseRepository("education_levels");
    const levelsList = [
      { educationLevelId: "LVL_JUNIOR", levelCode: "JUNIOR_HIGH", nameTh: "มัธยมศึกษาตอนต้น (ม.1-ม.3)", nameEn: "Junior High School" },
      { educationLevelId: "LVL_SENIOR", levelCode: "SENIOR_HIGH", nameTh: "มัธยมศึกษาตอนปลาย (ม.4-ม.6)", nameEn: "Senior High School" }
    ];
    levelsList.forEach(lvl => {
      if (!levelsRepo.exists({ educationLevelId: lvl.educationLevelId }, null)) {
        levelsRepo.create(lvl, actorContext);
      }
    });

    // 7. Seed Default Medal Rules
    const medalRepo = new BaseRepository("medal_rules");
    const medalList = [
      { medalRuleId: "MR_GOLD", medalType: "เหรียญทอง", minimumScore: "80.00", maximumScore: "100.00" },
      { medalRuleId: "MR_SILVER", medalType: "เหรียญเงิน", minimumScore: "70.00", maximumScore: "79.99" },
      { medalRuleId: "MR_BRONZE", medalType: "เหรียญทองแดง", minimumScore: "60.00", maximumScore: "69.99" },
      { medalRuleId: "MR_PARTICIPATION", medalType: "เข้าร่วม", minimumScore: "0.00", maximumScore: "59.99" }
    ];
    medalList.forEach(mr => {
      if (!medalRepo.exists({ medalRuleId: mr.medalRuleId }, null)) {
        medalRepo.create(mr, actorContext);
      }
    });

    // 8. Seed Default Settings
    const settingsRepo = new BaseRepository("settings");
    const settingsList = [
      { settingId: "SET_YEAR", key: "academic_year", value: "2569", description: "Academic year of the tournament", type: "STRING" },
      { settingId: "SET_REG_LOCK", key: "registration_locked", value: "false", description: "Lock registration changes system-wide", type: "BOOLEAN" },
      { settingId: "SET_CERT_LOCK", key: "certificates_locked", value: "false", description: "Lock certificate generation changes", type: "BOOLEAN" }
    ];
    settingsList.forEach(set => {
      if (!settingsRepo.exists({ settingId: set.settingId }, null)) {
        settingsRepo.create(set, actorContext);
      }
    });

    // 9. Clean Legacy Mock Schools (with underscores in schoolId)
    try {
      const schoolsRepo = new BaseRepository("schools");
      const allSchools = schoolsRepo.findAll({}, null);
      allSchools.forEach(s => {
        if (s.schoolId && s.schoolId.includes("_")) {
          schoolsRepo.delete({ schoolId: s.schoolId }, actorContext);
        }
      });
    } catch (err) {
      // Ignore if clean fails
    }

    return { success: true };
  }
};
