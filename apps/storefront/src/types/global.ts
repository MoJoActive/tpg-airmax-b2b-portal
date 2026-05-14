export interface SimpleObject {
  [k: string]: string | number | undefined | null;
}

export enum Environment {
  Local = 'local',
  Integration = 'integration',
  Staging = 'staging',
  Production = 'production',
}

export type EnvSpecificConfig<T> = Record<Environment, T>;

export interface Address {
  city: string;
  company: string;
  country: string;
  country_iso2: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  state: string;
  street_1: string;
  street_2: string;
  zip: string;
}
