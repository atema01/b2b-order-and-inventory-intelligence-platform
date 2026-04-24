const CONTROL_CHARACTERS_REGEX = /[\u0000-\u001F\u007F]/g;
const PASSWORD_CONTROL_CHARACTERS_REGEX = /[\u0000-\u0008\u000A-\u001F\u007F]/g;

export interface LoginValidationResult {
  isValid: boolean;
  error?: string;
  cleanedIdentifier: string;
  cleanedPassword: string;
}

const sanitizeIdentifierInput = (value: string): string => {
  return value.replace(CONTROL_CHARACTERS_REGEX, '').trim();
};

const sanitizePasswordInput = (value: string): string => {
  return value.replace(PASSWORD_CONTROL_CHARACTERS_REGEX, '');
};

export const validateLoginPayload = (
  identifier: unknown,
  password: unknown
): LoginValidationResult => {
  const cleanedIdentifier = typeof identifier === 'string' ? sanitizeIdentifierInput(identifier) : '';
  const cleanedPassword = typeof password === 'string' ? sanitizePasswordInput(password) : '';

  if (!cleanedIdentifier) {
    return {
      isValid: false,
      error: 'Username or email is required.',
      cleanedIdentifier,
      cleanedPassword,
    };
  }

  if (/\s/.test(cleanedIdentifier)) {
    return {
      isValid: false,
      error: 'Username or email cannot contain spaces.',
      cleanedIdentifier,
      cleanedPassword,
    };
  }

  if (cleanedIdentifier.length > 254) {
    return {
      isValid: false,
      error: 'Username or email is too long.',
      cleanedIdentifier,
      cleanedPassword,
    };
  }

  if (!cleanedPassword) {
    return {
      isValid: false,
      error: 'Password is required.',
      cleanedIdentifier,
      cleanedPassword,
    };
  }

  if (!cleanedPassword.trim()) {
    return {
      isValid: false,
      error: 'Password cannot be only spaces.',
      cleanedIdentifier,
      cleanedPassword,
    };
  }

  if (cleanedPassword.length > 128) {
    return {
      isValid: false,
      error: 'Password is too long.',
      cleanedIdentifier,
      cleanedPassword,
    };
  }

  return {
    isValid: true,
    cleanedIdentifier,
    cleanedPassword,
  };
};
