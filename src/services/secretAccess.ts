import { getLogger } from "@logtape/logtape";

const logger = getLogger("app.services.secretAccess");

const STORAGE_KEY = "fliro_secret_access";

export function grantSecretAccess(code: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, code);
  } catch (error) {
    logger.warn`Failed to save secret access: ${error}`;
  }
}

export function consumeSecretAccess() {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY);
    if (value) {
      sessionStorage.removeItem(STORAGE_KEY);
    }
    return value;
  } catch (error) {
    logger.warn`Failed to read secret access: ${error}`;
    return null;
  }
}

export function hasSecretAccess(code: string) {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY);
    return value === code;
  } catch (error) {
    return false;
  }
}
