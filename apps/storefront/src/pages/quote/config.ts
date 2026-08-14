import { LangFormatFunction } from '@b3/lang';

import { deCodeField } from '../Registered/config';

export interface QuoteAddressFormField {
  name: string;
  label?: string;
  required?: boolean;
  default?: string | number | Array<string | number>;
  fieldType?: string | number;
  custom?: boolean;
  xs?: number;
  variant?: string;
  size?: string;
  options?: Array<Record<string, string | number>>;
  replaceOptions?: {
    label: string;
    value: string;
  };
  [key: string]: unknown;
}

type QuoteAddressExtraFieldValue = {
  fieldName: string;
  fieldValue: string;
};

export const buildAddressWithExtraFields = (
  address: CustomFieldItems,
  formFields: QuoteAddressFormField[],
) => {
  const customFields = formFields.filter((field) => field.custom);
  if (customFields.length === 0) {
    return address;
  }

  const newAddress: CustomFieldItems = { ...address };
  const existingExtras: QuoteAddressExtraFieldValue[] = Array.isArray(address.extraFields)
    ? address.extraFields
    : [];

  const extraFields = customFields.map((field) => {
    const fieldName = deCodeField(field.name);
    const existing = existingExtras.find((item) => item.fieldName === fieldName);
    const fieldValue = newAddress[field.name] ?? existing?.fieldValue ?? field.default ?? '';

    delete newAddress[field.name];

    return {
      fieldName,
      fieldValue: fieldValue === undefined || fieldValue === null ? '' : String(fieldValue),
    };
  });

  delete newAddress.extraFields;

  return {
    ...newAddress,
    extraFields,
  };
};

export const hasMissingRequiredAddressExtraFields = (
  address: CustomFieldItems | undefined,
  formFields: QuoteAddressFormField[],
) => {
  if (!address) return false;

  return formFields
    .filter((field) => field.custom && field.required)
    .some((field) => {
      const fieldName = deCodeField(field.name);
      const nestedValue = Array.isArray(address.extraFields)
        ? address.extraFields.find(
            (item: QuoteAddressExtraFieldValue) => item.fieldName === fieldName,
          )?.fieldValue
        : undefined;
      const value = address[field.name] ?? nestedValue ?? '';
      return !String(value).trim();
    });
};

const getAccountFormFields = (
  isMobile: boolean,
  b3Lang: LangFormatFunction,
): QuoteAddressFormField[] => {
  const accountFormFields: QuoteAddressFormField[] = [
    {
      name: 'label',
      label: b3Lang('quoteDraft.config.addressLabel'),
      required: false,
      default: '',
      fieldType: 'text',
      xs: 12,
      variant: 'filled',
      size: 'small',
    },
    {
      name: 'firstName',
      label: b3Lang('quoteDraft.config.firstName'),
      required: false,
      default: '',
      fieldType: 'text',
      xs: isMobile ? 12 : 6,
      variant: 'filled',
      size: 'small',
    },
    {
      name: 'lastName',
      label: b3Lang('quoteDraft.config.lastName'),
      required: false,
      default: '',
      fieldType: 'text',
      xs: isMobile ? 12 : 6,
      variant: 'filled',
      size: 'small',
    },
    {
      name: 'companyName',
      label: b3Lang('quoteDraft.config.company'),
      required: false,
      default: '',
      fieldType: 'text',
      xs: 12,
      variant: 'filled',
      size: 'small',
    },
    {
      name: 'country',
      label: b3Lang('quoteDraft.config.country'),
      required: false,
      default: '',
      fieldType: 'dropdown',
      options: [],
      xs: 12,
      variant: 'filled',
      size: 'small',
      replaceOptions: {
        label: 'countryName',
        value: 'countryCode',
      },
    },
    {
      name: 'address',
      label: b3Lang('quoteDraft.config.addressLine1'),
      required: false,
      default: '',
      fieldType: 'text',
      xs: 12,
      variant: 'filled',
      size: 'small',
    },
    {
      name: 'apartment',
      label: b3Lang('quoteDraft.config.addressLine2'),
      required: false,
      default: '',
      fieldType: 'text',
      xs: 12,
      variant: 'filled',
      size: 'small',
    },
    {
      name: 'city',
      label: b3Lang('quoteDraft.config.city'),
      required: false,
      default: '',
      fieldType: 'text',
      options: [],
      xs: 12,
      variant: 'filled',
      size: 'small',
    },
    {
      name: 'state',
      label: b3Lang('quoteDraft.config.state'),
      required: false,
      default: '',
      fieldType: 'text',
      options: [],
      xs: isMobile ? 12 : 6,
      variant: 'filled',
      size: 'small',
      replaceOptions: {
        label: 'stateName',
        value: 'stateName',
      },
    },
    {
      name: 'zipCode',
      label: b3Lang('quoteDraft.config.zipCode'),
      required: false,
      default: '',
      fieldType: 'text',
      options: [],
      xs: isMobile ? 12 : 6,
      variant: 'filled',
      size: 'small',
    },
    {
      name: 'phoneNumber',
      label: b3Lang('quoteDraft.config.phoneNumber'),
      required: false,
      default: '',
      fieldType: 'text',
      xs: 12,
      variant: 'filled',
      size: 'small',
    },
  ];

  return accountFormFields;
};

export default getAccountFormFields;
