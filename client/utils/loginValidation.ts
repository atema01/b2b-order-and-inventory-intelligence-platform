const CONTROL_CHARACTERS_REGEX = /[\u0000-\u001F\u007F]/g;
const PASSWORD_CONTROL_CHARACTERS_REGEX = /[\u0000-\u0008\u000A-\u001F\u007F]/g;

export const sanitizeLoginIdentifierInput = (value: string): string => {
  return value.replace(CONTROL_CHARACTERS_REGEX, '').replace(/^\s+/, '');
};

export const normalizeLoginIdentifier = (value: string): string => {
  return sanitizeLoginIdentifierInput(value).trim();
};

export const sanitizeLoginPasswordInput = (value: string): string => {
  return value.replace(PASSWORD_CONTROL_CHARACTERS_REGEX, '');
};

export const validateLoginCredentials = (
  identifier: string,
  password: string
): { isValid: boolean; error?: string; cleanedIdentifier: string; cleanedPassword: string } => {
  const cleanedIdentifier = normalizeLoginIdentifier(identifier);
  const cleanedPassword = sanitizeLoginPasswordInput(password);

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
