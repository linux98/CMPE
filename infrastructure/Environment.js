/**
 * Competition Platform Engineering Standards (CPES)
 * Infrastructure Environment Configuration
 */

const CMPE_ENVIRONMENT = {
  getSpreadsheetId() {
    // Falls back to active spreadsheet if script property is unset
    try {
      const propId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
      if (propId) return propId;
    } catch (e) {
      // Ignored during localized mock environments
    }
    return SpreadsheetApp.getActiveSpreadsheet().getId();
  },

  getAcademicYear() {
    try {
      const year = PropertiesService.getScriptProperties().getProperty("ACADEMIC_YEAR");
      if (year) return year;
    } catch (e) {}
    return "2569"; // Frozen baseline default
  },

  getDefaultTenantId() {
    try {
      return PropertiesService.getScriptProperties().getProperty("DEFAULT_TENANT_ID") ||
        "sakon1234";
    } catch (e) {
      return "sakon1234";
    }
  },

  getTelegramBotToken() {
    try {
      return PropertiesService.getScriptProperties().getProperty("TELEGRAM_BOT_TOKEN") || "";
    } catch (e) {
      return "";
    }
  },

  getTelegramChatId() {
    try {
      return PropertiesService.getScriptProperties().getProperty("TELEGRAM_CHAT_ID") || "";
    } catch (e) {
      return "";
    }
  }
};
