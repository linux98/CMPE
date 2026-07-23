/**
 * Competition Platform Engineering Standards (CPES)
 * Master Data Bounded Context - Domain Entities & Value Objects
 */

class GeographicCoordinate {
  constructor(lat, lng) {
    this.latitude = parseFloat(lat);
    this.longitude = parseFloat(lng);
  }

  isValid() {
    if (isNaN(this.latitude) || isNaN(this.longitude)) return false;
    return this.latitude >= -90 && this.latitude <= 90 &&
           this.longitude >= -180 && this.longitude <= 180;
  }
}

class EmailAddress {
  constructor(email) {
    this.value = (email || "").trim().toLowerCase();
  }

  isValid() {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(this.value);
  }
}

class TenantEntity {
  constructor(data) {
    this.tenantId = data.tenantId || "";
    this.name = data.name || "";
    this.province = data.province || "";
    this.adminUsername = data.adminUsername || "";
    this.adminPasswordHash = data.adminPasswordHash || "";
    this.status = data.status || "ACTIVE"; // ACTIVE, SUSPENDED, ARCHIVED
    
    // Metadata columns
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class AcademicYearEntity {
  constructor(data) {
    this.academicYearId = data.academicYearId || "";
    this.yearValue = data.yearValue || "";
    this.status = data.status || "ACTIVE"; // ACTIVE, CLOSED, ARCHIVED
    this.isCurrent = data.isCurrent === true || data.isCurrent === "TRUE" || data.isCurrent === "true";
    
    // Metadata
    this.tenantId = data.tenantId || "";
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class ProvinceEntity {
  constructor(data) {
    this.provinceId = data.provinceId || "";
    this.provinceCode = data.provinceCode || "";
    this.nameTh = data.nameTh || "";
    this.nameEn = data.nameEn || "";
    this.status = data.status || "ACTIVE";
    
    // Metadata
    this.tenantId = data.tenantId || "";
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class DistrictEntity {
  constructor(data) {
    this.districtId = data.districtId || "";
    this.provinceId = data.provinceId || "";
    this.districtCode = data.districtCode || "";
    this.nameTh = data.nameTh || "";
    this.nameEn = data.nameEn || "";
    this.status = data.status || "ACTIVE";
    
    // Metadata
    this.tenantId = data.tenantId || "";
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class SchoolEntity {
  constructor(data) {
    this.schoolId = data.schoolId || "";
    this.nameTh = data.nameTh || "";
    this.nameEn = data.nameEn || "";
    this.districtId = data.districtId || "";
    this.status = data.status || "ACTIVE";
    this.latitude = data.latitude || "";
    this.longitude = data.longitude || "";
    this.email = data.email ? new EmailAddress(data.email).value : "";
    this.phone = data.phone || "";
    
    // Metadata
    this.tenantId = data.tenantId || "";
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }

  validateCoords() {
    if (this.latitude || this.longitude) {
      const coord = new GeographicCoordinate(this.latitude, this.longitude);
      return coord.isValid();
    }
    return true; // Coordinates are optional for schools
  }
}

class EducationLevelEntity {
  constructor(data) {
    this.educationLevelId = data.educationLevelId || "";
    this.levelCode = data.levelCode || ""; // e.g. PRIMARY, JUNIOR_HIGH
    this.nameTh = data.nameTh || "";
    this.nameEn = data.nameEn || "";
    this.status = data.status || "ACTIVE";
    
    // Metadata
    this.tenantId = data.tenantId || "";
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class CompetitionTypeEntity {
  constructor(data) {
    this.competitionTypeId = data.competitionTypeId || "";
    this.typeCode = data.typeCode || "";
    this.nameTh = data.nameTh || "";
    this.nameEn = data.nameEn || "";
    this.status = data.status || "ACTIVE";
    this.defaultTeamMode = data.defaultTeamMode || "SINGLE"; // SINGLE, TEAM, PAIR
    
    // Metadata
    this.tenantId = data.tenantId || "";
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }
}

class CompetitionCategoryEntity {
  constructor(data) {
    this.categoryId = data.categoryId || "";
    this.categoryCode = data.categoryCode || "";
    this.nameTh = data.nameTh || "";
    this.nameEn = data.nameEn || "";
    this.competitionTypeId = data.competitionTypeId || "";
    this.educationLevelId = data.educationLevelId || "";
    this.minimumParticipants = parseInt(data.minimumParticipants) || 1;
    this.maximumParticipants = parseInt(data.maximumParticipants) || 1;
    this.minimumCoaches = parseInt(data.minimumCoaches) || 0;
    this.maximumCoaches = parseInt(data.maximumCoaches) || 1;
    this.status = data.status || "ACTIVE";
    
    // Metadata
    this.tenantId = data.tenantId || "";
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }

  validateLimits() {
    return this.minimumParticipants >= 1 &&
           this.maximumParticipants >= this.minimumParticipants &&
           this.minimumCoaches >= 0 &&
           this.maximumCoaches >= this.minimumCoaches;
  }
}

class VenueEntity {
  constructor(data) {
    this.venueId = data.venueId || "";
    this.name = data.name || "";
    this.address = data.address || "";
    this.schoolId = data.schoolId || ""; // Optional linked school
    this.latitude = data.latitude || "";
    this.longitude = data.longitude || "";
    this.status = data.status || "ACTIVE";
    this.type = data.type || "PHYSICAL"; // PHYSICAL, ONLINE
    this.capacity = parseInt(data.capacity) || 0;
    
    // Metadata
    this.tenantId = data.tenantId || "";
    this.createdTimestamp = data.createdTimestamp || "";
    this.createdBy = data.createdBy || "";
    this.lastModifiedTimestamp = data.lastModifiedTimestamp || "";
    this.lastModifiedBy = data.lastModifiedBy || "";
    this.rowVersion = parseInt(data.rowVersion) || 1;
    this.recordStatus = data.recordStatus || "ACTIVE";
  }

  validateCoordinates() {
    if (this.type === "ONLINE") return true; // Online venues don't require coordinates
    if (this.latitude || this.longitude) {
      const coord = new GeographicCoordinate(this.latitude, this.longitude);
      return coord.isValid();
    }
    return true; // Optional for physical
  }
}
