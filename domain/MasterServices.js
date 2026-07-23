/**
 * Competition Platform Engineering Standards (CPES)
 * Master Data Bounded Context - Application Services
 */

class TenantService {
  constructor(tenantRepo) {
    this.tenantRepo = tenantRepo;
  }

  createTenant(payload, actor) {
    const tenant = new TenantEntity(payload);
    tenant.tenantId = payload.tenantId || CMPE_UTILITIES.generateUuid();
    tenant.status = "ACTIVE";
    return this.tenantRepo.create(tenant, actor);
  }

  updateTenant(payload, expectedRowVersion, actor) {
    const current = this.tenantRepo.findById(payload.tenantId, null);
    if (!current) throw new Error("ERR_TENANT_NOT_FOUND");
    const tenant = new TenantEntity(Object.assign({}, current, payload, {
      // Never accept a password hash from the browser. Preserve the server value.
      adminPasswordHash: current.adminPasswordHash
    }));
    return this.tenantRepo.update(tenant, expectedRowVersion, actor);
  }

  transitionStatus(tenantId, newStatus, expectedRowVersion, actor) {
    const row = this.tenantRepo.findById(tenantId, null);
    if (!row) throw new Error("ERR_TENANT_NOT_FOUND");
    
    const tenant = new TenantEntity(row);
    tenant.status = newStatus;
    return this.tenantRepo.update(tenant, expectedRowVersion, actor);
  }
}

class AcademicYearService {
  constructor(yearRepo) {
    this.yearRepo = yearRepo;
  }

  createYear(payload, actor) {
    const year = new AcademicYearEntity(payload);
    year.academicYearId = payload.academicYearId || "AY_" + payload.yearValue;
    year.status = "ACTIVE";
    year.isCurrent = false;
    return this.yearRepo.create(year, actor);
  }

  updateYear(payload, expectedRowVersion, actor) {
    const year = new AcademicYearEntity(payload);
    return this.yearRepo.update(year, expectedRowVersion, actor);
  }

  setCurrentYear(yearId, actor) {
    this.yearRepo.setCurrent(yearId, actor.tenantId);
    return { success: true };
  }
}

class GeographicService {
  constructor(provinceRepo, districtRepo) {
    this.provinceRepo = provinceRepo;
    this.districtRepo = districtRepo;
  }

  // Province
  createProvince(payload, actor) {
    const prov = new ProvinceEntity(payload);
    prov.provinceId = payload.provinceId || "PROV_" + payload.provinceCode;
    return this.provinceRepo.create(prov, actor);
  }

  // District
  createDistrict(payload, actor) {
    // Check if province exists
    const prov = this.provinceRepo.findById(payload.provinceId, null);
    if (!prov) throw new Error("ERR_PROVINCE_NOT_FOUND: Referenced province is missing or inactive.");
    
    const dist = new DistrictEntity(payload);
    dist.districtId = payload.districtId || "DIST_" + payload.districtCode;
    return this.districtRepo.create(dist, actor);
  }
}

class SchoolService {
  constructor(schoolRepo, districtRepo) {
    this.schoolRepo = schoolRepo;
    this.districtRepo = districtRepo;
  }

  createSchool(payload, actor) {
    // Validate geographic district relationship
    const dist = this.districtRepo.findById(payload.districtId, null);
    if (!dist) throw new Error("ERR_GEOGRAPHY_INVALID: Referenced district ID is invalid.");
    
    const school = new SchoolEntity(payload);
    school.schoolId = payload.schoolId || "SCH_" + payload.schoolCode;
    
    if (!school.validateCoords()) {
      throw new Error("ERR_COORDINATES_INVALID: Latitude must be between -90 and 90; Longitude between -180 and 180.");
    }
    
    return this.schoolRepo.create(school, actor);
  }

  updateSchool(payload, expectedRowVersion, actor) {
    const school = new SchoolEntity(payload);
    if (!school.validateCoords()) {
      throw new Error("ERR_COORDINATES_INVALID");
    }
    return this.schoolRepo.update(school, expectedRowVersion, actor);
  }

  /**
   * Processes CSV input for bulk school provisioning
   */
  importSchoolsCsv(csvContent, atomic = true, actor) {
    // Basic CSV parser (splits lines and handles commas)
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
    if (lines.length <= 1) throw new Error("ERR_CSV_EMPTY: No data found.");
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const parsedRows = [];
    const errors = [];
    
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      const rowObj = {};
      headers.forEach((h, idx) => {
        rowObj[h] = cols[idx];
      });
      
      // Perform validation
      let rowValid = true;
      if (!rowObj.schoolCode) {
        errors.push(`Row ${i + 1}: Missing schoolCode.`);
        rowValid = false;
      }
      if (!rowObj.nameTh) {
        errors.push(`Row ${i + 1}: Missing nameTh.`);
        rowValid = false;
      }
      
      // Validate district relationship
      const dist = this.districtRepo.findById(rowObj.districtId, null);
      if (!dist) {
        errors.push(`Row ${i + 1}: Invalid districtId (${rowObj.districtId}).`);
        rowValid = false;
      }
      
      // Validate coords
      if (rowObj.latitude || rowObj.longitude) {
        const coord = new GeographicCoordinate(rowObj.latitude, rowObj.longitude);
        if (!coord.isValid()) {
          errors.push(`Row ${i + 1}: Coordinates out of bounds.`);
          rowValid = false;
        }
      }
      
      if (rowValid) {
        parsedRows.push(rowObj);
      }
    }
    
    if (errors.length > 0 && atomic) {
      throw new Error("ERR_IMPORT_FAILED: validation failures aborting atomic execution:\n" + errors.join("\n"));
    }
    
    // Commit batch writes
    parsedRows.forEach(row => {
      row.tenantId = actor.tenantId;
      row.schoolId = "SCH_" + row.schoolCode;
      if (!this.schoolRepo.exists({ schoolId: row.schoolId }, actor.tenantId)) {
        this.schoolRepo.create(row, actor);
      }
    });
    
    return {
      success: true,
      importedCount: parsedRows.length,
      errors: errors
    };
  }
}

class EducationLevelService {
  constructor(levelRepo) {
    this.levelRepo = levelRepo;
  }

  createLevel(payload, actor) {
    const lvl = new EducationLevelEntity(payload);
    lvl.educationLevelId = payload.educationLevelId || "LVL_" + payload.levelCode;
    return this.levelRepo.create(lvl, actor);
  }
}

class CompetitionTypeService {
  constructor(typeRepo) {
    this.typeRepo = typeRepo;
  }

  createType(payload, actor) {
    const type = new CompetitionTypeEntity(payload);
    type.competitionTypeId = payload.competitionTypeId || "TYPE_" + payload.typeCode;
    return this.typeRepo.create(type, actor);
  }
}

class CompetitionCategoryService {
  constructor(categoryRepo, typeRepo, levelRepo) {
    this.categoryRepo = categoryRepo;
    this.typeRepo = typeRepo;
    this.levelRepo = levelRepo;
  }

  createCategory(payload, actor) {
    // Validate competition type relationship
    const type = this.typeRepo.findById(payload.competitionTypeId, null);
    if (!type) throw new Error("ERR_RELATION_INVALID: Referenced competition type is invalid.");
    
    // Validate education level relationship
    const level = this.levelRepo.findById(payload.educationLevelId, null);
    if (!level) throw new Error("ERR_RELATION_INVALID: Referenced education level is invalid.");
    
    const cat = new CompetitionCategoryEntity(payload);
    cat.categoryId = payload.categoryId || "CAT_" + payload.categoryCode;
    
    if (!cat.validateLimits()) {
      throw new Error("ERR_LIMITS_INVALID: Max participant limit cannot be lower than min limit.");
    }
    
    return this.categoryRepo.create(cat, actor);
  }
}

class VenueService {
  constructor(venueRepo, schoolRepo, districtRepo) {
    this.venueRepo = venueRepo;
    this.schoolRepo = schoolRepo;
    this.districtRepo = districtRepo;
  }

  createVenue(payload, actor) {
    // Validate school relationship if provided
    if (payload.schoolId) {
      const school = this.schoolRepo.findById(payload.schoolId, actor.tenantId);
      if (!school) throw new Error("ERR_RELATION_INVALID: School must belong to the same tenant.");
    }
    
    const venue = new VenueEntity(payload);
    venue.venueId = payload.venueId || "VN_" + payload.venueCode;
    venue.tenantId = actor.tenantId;
    
    if (!venue.validateCoordinates()) {
      throw new Error("ERR_COORDINATES_INVALID");
    }
    
    return this.venueRepo.create(venue, actor);
  }
}
