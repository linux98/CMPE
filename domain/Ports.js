/**
 * Competition Platform Engineering Standards (CPES)
 * Hexagonal Architecture Domain Ports
 */

class IUuidGenerator {
  generate() {
    throw new Error("IUuidGenerator.generate() not implemented");
  }
}

class IClock {
  nowIsoString() {
    throw new Error("IClock.nowIsoString() not implemented");
  }
  nowEpochMs() {
    throw new Error("IClock.nowEpochMs() not implemented");
  }
}

class IPasswordHasher {
  hash(password, salt, iterations) {
    throw new Error("IPasswordHasher.hash() not implemented");
  }
  generateSalt() {
    throw new Error("IPasswordHasher.generateSalt() not implemented");
  }
  constantTimeCompare(hash1, hash2) {
    throw new Error("IPasswordHasher.constantTimeCompare() not implemented");
  }
}

class IRepository {
  findById(id, tenantContext) {
    throw new Error("IRepository.findById() not implemented");
  }
  findByIds(ids, tenantContext) {
    throw new Error("IRepository.findByIds() not implemented");
  }
  exists(uniqueSpecification, tenantContext) {
    throw new Error("IRepository.exists() not implemented");
  }
  create(entity, actorContext) {
    throw new Error("IRepository.create() not implemented");
  }
  update(entity, expectedRowVersion, actorContext) {
    throw new Error("IRepository.update() not implemented");
  }
  archive(id, expectedRowVersion, actorContext) {
    throw new Error("IRepository.archive() not implemented");
  }
}
