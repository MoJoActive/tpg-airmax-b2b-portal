import B3Request from '../../request/b3Fetch';
import { RequestType } from '../../request/base';

interface CompanyExtraField {
  fieldName: string;
  fieldValue: string;
}

interface CompanyExtraFields {
  extraFields: CompanyExtraField[];
}

export const getCompanyExtraFields = async (companyId: number | string) => {
  const response = await B3Request.get(
    `/api/v2/companies/${companyId}/basic-info`,
    RequestType.B2BRest,
  );

  const data = response.data as CompanyExtraFields;

  return {
    logoUrl: data.extraFields.find((field) => field.fieldName === 'Logo URL')?.fieldValue || '',
    terms:
      data.extraFields.find((field) => field.fieldName === 'Terms & Conditions')?.fieldValue || '',
  };
};
