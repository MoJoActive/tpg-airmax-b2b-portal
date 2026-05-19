import { Environment, EnvSpecificConfig } from '@/types';
import b2bLogger from '@/utils/b3Logger';

const { VITE_B2B_URL, VITE_B2B_CLIENT_ID, VITE_IS_LOCAL_ENVIRONMENT } = import.meta.env;

const ENVIRONMENT_B2B_API_URL: EnvSpecificConfig<string> = {
  local: VITE_B2B_URL ?? 'http://localhost:9000',
  integration: 'https://api-b2b.integration.zone',
  staging: 'https://api-b2b.staging.zone',
  production: 'https://api-b2b.bigcommerce.com',
};

const ENVIRONMENT_B2B_APP_CLIENT_ID: EnvSpecificConfig<string> = {
  local: VITE_B2B_CLIENT_ID ?? 'qxvapwlk4fbb9dyogdcxk9o50d9jqjo',
  integration: 'leg40ozqqvl0r08spvs0viatax4egbz',
  staging: 't2tu7i9ap01r4o7cpocngz3xose8dvp',
  production: 'qxvapwlk4fbb9dyogdcxk9o50d9jqjo',
};

const DEFAULT_ENVIRONMENT =
  VITE_IS_LOCAL_ENVIRONMENT === 'TRUE' ? Environment.Local : Environment.Production;

function isEnvironment(value?: string): value is Environment {
  if (!value) {
    return false;
  }

  return Object.values<string>(Environment).includes(value);
}

const getEnvironment = (environment?: Environment): Environment => {
  if (environment) {
    return environment;
  }

  const b3Environment = (window as any).B3?.setting?.environment;
  if (isEnvironment(b3Environment)) {
    return b3Environment;
  }

  if (b3Environment !== undefined) {
    b2bLogger.error(
      `[B3] Unrecognized B3.setting.environment "${b3Environment}"; falling back to "${DEFAULT_ENVIRONMENT}". Valid: ${Object.values(
        Environment,
      ).join(', ')}.`,
    );
  }

  return DEFAULT_ENVIRONMENT;
};

export function getAPIBaseURL(environment?: Environment) {
  return ENVIRONMENT_B2B_API_URL[getEnvironment(environment)];
}

export function getAppClientId(environment?: Environment) {
  return ENVIRONMENT_B2B_APP_CLIENT_ID[getEnvironment(environment)];
}

enum RequestType {
  B2BGraphql = 'B2BGraphql',
  BCGraphql = 'BCGraphql',
  BCProxyGraphql = 'BCProxyGraphql',
  B2BRest = 'B2BRest',
  BCRest = 'BCRest',
  TranslationService = 'TranslationService',
}

export type RequestTypeKeys = keyof typeof RequestType;

const queryParse = <T>(query: T): string => {
  let queryText = '';

  Object.keys(query || {}).forEach((key: string) => {
    queryText += `${key}=${(query as any)[key]}&`;
  });
  return queryText.slice(0, -1);
};

export { queryParse, RequestType };
