/**
 * Competition Platform Engineering Standards (CPES)
 * Stage 3 Automated Master Data Integration & Security Tests
 */

const CMPE_STAGE3_TESTS = {
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
    const actorContext = { userId: "TEST_USER_1", tenantId: tenantId, roles: ["SUPER_ADMIN"] };

    Logger.log("--- Starting Stage 3 Master Data Bounded Context Tests ---");

    // 1. Unit Tests: Entity Constraints & Coordinates Validations
    try {
      const coord1 = new GeographicCoordinate("15.1234", "102.1234");
      assert(coord1.isValid(), "Valid coordinates rejected");
      
      const coord2 = new GeographicCoordinate("100.0", "200.0"); // Out of bounds
      assert(!coord2.isValid(), "Invalid coordinates allowed");

      const email1 = new EmailAddress("test@school.go.th");
      assert(email1.isValid(), "Valid email address rejected");
      
      const email2 = new EmailAddress("invalid-email-no-at");
      assert(!email2.isValid(), "Invalid email address allowed");

      const category = new CompetitionCategoryEntity({
        categoryId: "CAT_TEST",
        categoryCode: "TEST_CODE",
        minimumParticipants: 3,
        maximumParticipants: 2, // Max is lower than min
        minimumCoaches: 0,
        maximumCoaches: 1
      });
      assert(!category.validateLimits(), "Invalid participant limits allowed");
    } catch (e) {
      assert(false, "Entity validation unit test error: " + e.toString());
    }

    // 2. Repository Tests: Academic Year Atomic switch checks
    try {
      const yearRepo = new AcademicYearRepository();
      
      // Clean old test years
      const ySheet = yearRepo.getSheet();
      if (ySheet.getLastRow() > 1) {
        const data = ySheet.getRange(2, 1, ySheet.getLastRow() - 1, ySheet.getLastColumn()).getValues();
        const headerMap = yearRepo.getHeaderMap(ySheet);
        const yValCol = headerMap["yearValue"] - 1;
        for (let i = data.length - 1; i >= 0; i--) {
          if (data[i][yValCol] === "2599" || data[i][yValCol] === "2600") {
            ySheet.deleteRow(i + 2);
          }
        }
      }

      const year1 = { academicYearId: "AY_2599", yearValue: "2599", status: "ACTIVE", isCurrent: true };
      const year2 = { academicYearId: "AY_2600", yearValue: "2600", status: "ACTIVE", isCurrent: false };

      yearRepo.create(year1, actorContext);
      yearRepo.create(year2, actorContext);

      // Trigger atomic switch
      yearRepo.setCurrent("AY_2600", tenantId);

      const retrieved1 = yearRepo.findById("AY_2599", null);
      const retrieved2 = yearRepo.findById("AY_2600", null);

      assert(retrieved2.isCurrent === "true" || retrieved2.isCurrent === true || retrieved2.isCurrent === "TRUE", "Current year isCurrent is not true");
      assert(retrieved1.isCurrent === "false" || retrieved1.isCurrent === false || retrieved1.isCurrent === "FALSE", "Previous current year isCurrent was not unset to false");
    } catch (e) {
      assert(false, "Academic year repository test failed: " + e.toString());
    }

    // 3. Integration Tests: Geography districts and schools constraints checks
    try {
      const schoolRepo = new SchoolRepository();
      const districtRepo = new DistrictRepository();
      const provinceRepo = new ProvinceRepository();
      
      // Clean old test schools/geography
      const sSheet = schoolRepo.getSheet();
      if (sSheet.getLastRow() > 1) {
        const data = sSheet.getRange(2, 1, sSheet.getLastRow() - 1, sSheet.getLastColumn()).getValues();
        const headerMap = schoolRepo.getHeaderMap(sSheet);
        const sNameCol = headerMap["nameTh"] - 1;
        for (let i = data.length - 1; i >= 0; i--) {
          if (data[i][sNameCol] === "โรงเรียนวิทยาศาสตร์ทวิภาค") {
            sSheet.deleteRow(i + 2);
          }
        }
      }

      // Check district mapping
      const testDist = { districtId: "DIST_TEST_99", provinceId: "PROV_SAKON", districtCode: "SKN_99", nameTh: "กุดบากเทส", nameEn: "Kut Bak Test", status: "ACTIVE" };
      if (!districtRepo.exists({ districtId: "DIST_TEST_99" }, null)) {
        districtRepo.create(testDist, actorContext);
      }

      const schoolSvc = new SchoolService(schoolRepo, districtRepo);
      const testSchool = {
        schoolId: "SCH_TEST_99",
        nameTh: "โรงเรียนวิทยาศาสตร์ทวิภาค",
        nameEn: "Science Twin School",
        districtId: "DIST_TEST_99",
        status: "ACTIVE",
        latitude: "15.1234",
        longitude: "102.1234",
        email: "contact@twinscience.ac.th",
        phone: "042123456",
        tenantId: tenantId
      };

      const createdSchool = schoolSvc.createSchool(testSchool, actorContext);
      assert(createdSchool !== null, "Failed to create school under validated district");
      assert(createdSchool.email === "contact@twinscience.ac.th", "Email normalization failed");

      // Verify coordinate range exception throws
      try {
        const badSchool = { ...testSchool, schoolId: "SCH_TEST_BAD", latitude: "200.0" }; // Bad latitude
        schoolSvc.createSchool(badSchool, actorContext);
        assert(false, "School creation bypassed coordinate boundaries checks");
      } catch (err) {
        assert(err.message.indexOf("ERR_COORDINATES_INVALID") !== -1, "Bad coords did not throw correct error code: " + err.message);
      }
    } catch (e) {
      assert(false, "School integration test failed: " + e.toString());
    }

    // 4. Integration Tests: CSV School Import batch parsing validations
    try {
      const schoolRepo = new SchoolRepository();
      const districtRepo = new DistrictRepository();
      const schoolSvc = new SchoolService(schoolRepo, districtRepo);

      // Mock CSV data with one valid row and one invalid row (bad districtId)
      const csvContent = "schoolCode,nameTh,nameEn,districtId,latitude,longitude,email,phone\n" +
                         "CSV_TEST_01,โรงเรียนไอทีวิทยา,IT Wittaya School,DIST_TEST_99,15.1234,102.1234,it@wittaya.ac.th,042111111\n" +
                         "CSV_TEST_02,โรงเรียนคอมวิทยา,COM Wittaya School,DIST_NON_EXISTENT,15.1234,102.1234,com@wittaya.ac.th,042222222";

      try {
        schoolSvc.importSchoolsCsv(csvContent, true, actorContext); // Atomic mode = true
        assert(false, "Atomic CSV import succeeded despite row-level validation errors");
      } catch (err) {
        assert(err.message.indexOf("ERR_IMPORT_FAILED") !== -1, "Atomic import failure did not throw correct error code");
      }

      // Cleanup CSV test rows from sheet directly
      const sheet = schoolRepo.getSheet();
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
        const headerMap = schoolRepo.getHeaderMap(sheet);
        const pkIdx = headerMap[schoolRepo.pkName] - 1;
        for (let i = data.length - 1; i >= 0; i--) {
          const val = data[i][pkIdx];
          if (val === "SCH_CSV_TEST_01" || val === "SCH_CSV_TEST_02") {
            sheet.deleteRow(i + 2);
          }
        }
      }
    } catch (e) {
      assert(false, "CSV Import integration test failed: " + e.toString());
    }

    // 5. Integration Tests: Venues same-tenant school validation checks
    try {
      const venueRepo = new VenueRepository();
      const schoolRepo = new SchoolRepository();
      const districtRepo = new DistrictRepository();
      const venueSvc = new VenueService(venueRepo, schoolRepo, districtRepo);

      // Clean old test venues
      const vSheet = venueRepo.getSheet();
      if (vSheet.getLastRow() > 1) {
        const data = vSheet.getRange(2, 1, vSheet.getLastRow() - 1, vSheet.getLastColumn()).getValues();
        const headerMap = venueRepo.getHeaderMap(vSheet);
        const vNameCol = headerMap["name"] - 1;
        for (let i = data.length - 1; i >= 0; i--) {
          if (data[i][vNameCol] === "ห้องแล็บคอมพิวเตอร์เทส") {
            vSheet.deleteRow(i + 2);
          }
        }
      }

      // Try creating venue referencing a school belonging to ANOTHER tenant (should reject!)
      // Let's create a school in another tenant first
      const foreignSchool = {
        schoolId: "SCH_FOREIGN_99",
        nameTh: "โรงเรียนตากปัญญา",
        nameEn: "Tak Panya School",
        districtId: "DIST_TEST_99",
        status: "ACTIVE",
        tenantId: "SESAO_UDON" // Different tenant
      };
      
      if (!schoolRepo.exists({ schoolId: "SCH_FOREIGN_99" }, "SESAO_UDON")) {
        schoolRepo.create(foreignSchool, { userId: "SYSTEM", tenantId: "SESAO_UDON" });
      }

      try {
        const testVenue = {
          venueId: "VN_TEST_99",
          venueCode: "VN_TEST_99",
          name: "ห้องแล็บคอมพิวเตอร์เทส",
          address: "อาคาร 2 ชั้น 3",
          schoolId: "SCH_FOREIGN_99", // Foreign school reference
          latitude: "15.1234",
          longitude: "102.1234",
          status: "ACTIVE",
          type: "PHYSICAL"
        };
        venueSvc.createVenue(testVenue, actorContext); // actor is SESAO_SAKON tenant
        assert(false, "Venue creation bypassed cross-tenant school checks");
      } catch (err) {
        assert(err.message.indexOf("ERR_RELATION_INVALID") !== -1 || err.message.indexOf("ERR_TENANT_ISOLATION_VIOLATION") !== -1, "Cross-tenant reference did not throw correct error code: " + err.message);
      }
    } catch (e) {
      assert(false, "Venue integration test failed: " + e.toString());
    }

    return results;
  }
};
