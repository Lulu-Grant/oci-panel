type RegistrationEnv = {
  AUTH_REGISTRATION_ENABLED?: string;
};

export function isPublicRegistrationEnabled(
  env: RegistrationEnv = process.env as RegistrationEnv,
  nodeEnv = process.env.NODE_ENV
) {
  const configured = env.AUTH_REGISTRATION_ENABLED?.trim().toLowerCase();

  if (configured) {
    return ["1", "true", "yes", "on"].includes(configured);
  }

  return nodeEnv !== "production";
}
