import { useContext, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useB3Lang } from '@b3/lang';
import { Box, FormLabel, styled, TextField } from '@mui/material';
import trim from 'lodash-es/trim';

import { B3CustomForm } from '@/components';
import CustomButton from '@/components/button/CustomButton';
import { b3HexToRgb, getContrastColor } from '@/components/outSideComponents/utils/b3CustomStyles';
import B3Spin from '@/components/spin/B3Spin';
import { useMobile } from '@/hooks';
import useStorageState from '@/hooks/useStorageState';
import { CustomStyleContext } from '@/shared/customStyleButton';
import {
  checkUserBCEmail,
  checkUserEmail,
  getB2BAccountFormFields,
  getB2BAccountSettings,
  getBCAccountSettings,
  updateB2BAccountSettings,
  updateBCAccountSettings,
} from '@/shared/service/b2b';
import { getCompanyExtraFields } from '@/shared/service/b2b/api/company';
import B3Request from '@/shared/service/request/b3Fetch';
import { RequestType } from '@/shared/service/request/base';
import { isB2BUserSelector, useAppSelector } from '@/store';
import { Fields, ParamProps } from '@/types/accountSetting';
import { B3SStorage, channelId, snackbar } from '@/utils';

import FileUpload from '../quote/components/FileUpload';
import { getAccountFormFields } from '../Registered/config';

import { getAccountSettingFiles } from './config';
import { b2bSubmitDataProcessing, bcSubmitDataProcessing, initB2BInfo, initBcInfo } from './utils';

function AccountSetting() {
  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors },
    setValue,
    setError,
  } = useForm({
    mode: 'onSubmit',
  });

  const [isFinshUpdate, setIsFinshUpdate] = useStorageState<boolean>(
    'sf-isFinshUpdate',
    false,
    sessionStorage,
  );
  const isB2BUser = useAppSelector(isB2BUserSelector);
  const companyInfoId = useAppSelector(({ company }) => company.companyInfo.id);
  const customer = useAppSelector(({ company }) => company.customer);
  const role = useAppSelector(({ company }) => company.customer.role);
  const salesRepCompanyId = useAppSelector(({ b2bFeatures }) => b2bFeatures.masqueradeCompany.id);
  const isAgenting = useAppSelector(({ b2bFeatures }) => b2bFeatures.masqueradeCompany.isAgenting);

  const {
    state: {
      portalStyle: { backgroundColor = '#FEF9F5' },
    },
  } = useContext(CustomStyleContext);

  const b3Lang = useB3Lang();

  const [isMobile] = useMobile();

  const navigate = useNavigate();

  const [accountInfoFormFields, setAccountInfoFormFields] = useState<Partial<Fields>[]>([]);

  const [decryptionFields, setDecryptionFields] = useState<Partial<Fields>[]>([]);

  const [extraFields, setExtraFields] = useState<Partial<Fields>[]>([]);

  const [isloadding, setLoadding] = useState<boolean>(false);

  const [accountSettings, setAccountSettings] = useState<any>({});

  const [isVisible, setIsVisible] = useState<boolean>(false);

  const companyId = role === 3 && isAgenting ? salesRepCompanyId : +companyInfoId;

  const isBCUser = !isB2BUser || (role === 3 && !isAgenting);

  useEffect(() => {
    const init = async () => {
      try {
        setLoadding(true);

        const accountFormAllFields = await getB2BAccountFormFields(isBCUser ? 1 : 2);

        const fn = !isBCUser ? getB2BAccountSettings : getBCAccountSettings;

        const params = !isBCUser
          ? {
              companyId,
            }
          : {};

        const key = !isBCUser ? 'accountSettings' : 'customerAccountSettings';

        const { [key]: accountSettings } = await fn(params);

        const accountFormFields = getAccountFormFields(
          accountFormAllFields.accountFormFields || [],
        );
        const { accountB2BFormFields, passwordModified } = getAccountSettingFiles(12, b3Lang);

        const contactInformation = (accountFormFields?.contactInformation || []).filter(
          (item: Partial<Fields>) => item.fieldId !== 'field_email_marketing_newsletter',
        );

        const contactInformationTranslatedLabels = JSON.parse(JSON.stringify(contactInformation));

        contactInformationTranslatedLabels.forEach(
          (element: { fieldId: string; label: string }) => {
            const currentElement = element;
            if (currentElement.fieldId === 'field_first_name') {
              currentElement.label = b3Lang('accountSettings.form.firstName');
            }
            if (currentElement.fieldId === 'field_last_name') {
              currentElement.label = b3Lang('accountSettings.form.lastName');
            }
            if (currentElement.fieldId === 'field_email') {
              currentElement.label = b3Lang('accountSettings.form.email');
            }
            if (currentElement.fieldId === 'field_phone_number') {
              currentElement.label = b3Lang('accountSettings.form.phoneNumber');
            }
          },
        );

        const { additionalInformation = [] } = accountFormFields;

        const fields = !isBCUser
          ? initB2BInfo(
              accountSettings,
              contactInformationTranslatedLabels,
              accountB2BFormFields,
              additionalInformation,
            )
          : initBcInfo(accountSettings, contactInformationTranslatedLabels, additionalInformation);

        const passwordModifiedTranslatedFields = JSON.parse(JSON.stringify(passwordModified)).map(
          (element: { label: string; idLang: string }) => {
            const passwordField = element;
            passwordField.label = b3Lang(element.idLang);

            return element;
          },
        );

        const all = [...fields, ...passwordModifiedTranslatedFields];

        const roleItem = all.find((item) => item.name === 'role');

        if (roleItem?.fieldType) roleItem.fieldType = 'text';

        setAccountInfoFormFields(all);

        setAccountSettings(accountSettings);

        setDecryptionFields(contactInformation);

        setExtraFields(additionalInformation);
      } finally {
        if (isFinshUpdate) {
          snackbar.success(b3Lang('accountSettings.notification.detailsUpdated'));
          setIsFinshUpdate(false);
        }
        setLoadding(false);
        setIsVisible(true);
      }
    };

    init();
    // disabling as we only need to run this once and values at starting render are good enough
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [companyLogo, setCompanyLogo] = useState<string>('');
  const [companyTerms, setCompanyTerms] = useState<string>('');
  const [termsUpdated, setTermsUpdated] = useState<boolean>(false);

  useEffect(() => {
    const getLogoAndTerms = async () => {
      const { logoUrl, terms } = await getCompanyExtraFields(companyId);
      setCompanyLogo(logoUrl);
      setValue('companyLogo', logoUrl);
      setCompanyTerms(terms);
      setValue('companyTerms', terms);
    };
    if (isB2BUser) getLogoAndTerms();
  }, [isB2BUser, companyId, setValue]);

  const validateEmailValue = async (emailValue: string) => {
    if (customer.emailAddress === trim(emailValue)) return true;
    const payload = {
      email: emailValue,
      channelId,
    };

    const { isValid }: CustomFieldItems = isBCUser
      ? await checkUserBCEmail(payload)
      : await checkUserEmail(payload);

    if (!isValid) {
      setError('email', {
        type: 'custom',
        message: b3Lang('accountSettings.notification.emailExists'),
      });
    }

    return isValid;
  };

  const passwordValidation = (data: Partial<ParamProps>) => {
    if (data.password !== data.confirmPassword) {
      setError('confirmPassword', {
        type: 'manual',
        message: b3Lang('global.registerComplete.passwordMatchPrompt'),
      });
      setError('password', {
        type: 'manual',
        message: b3Lang('global.registerComplete.passwordMatchPrompt'),
      });
      return false;
    }

    return true;
  };

  const emailValidation = (data: Partial<ParamProps>) => {
    if (data.email !== customer.emailAddress && !data.currentPassword) {
      snackbar.error(b3Lang('accountSettings.notification.updateEmailPassword'));
      return false;
    }
    return true;
  };

  const handleAddUserClick = () => {
    handleSubmit(async (data: CustomFieldItems) => {
      setLoadding(true);

      try {
        const isValid = await validateEmailValue(data.email);

        const emailFlag = emailValidation(data);

        const passwordFlag = passwordValidation(data);

        if (isB2BUser && termsUpdated) {
          B3Request.put(`/api/v2/companies/${companyId}/basic-info`, RequestType.B2BRest, {
            extraFields: [
              {
                fieldName: 'Terms & Conditions',
                fieldValue: companyTerms,
              },
            ],
          });
        }

        const dataProcessingFn = isB2BUser ? b2bSubmitDataProcessing : bcSubmitDataProcessing;

        if (isValid && emailFlag && passwordFlag) {
          const { isEdit, param } = dataProcessingFn(
            data,
            accountSettings,
            decryptionFields,
            extraFields,
          );

          if (isEdit) {
            if (isB2BUser) {
              param.companyId = companyId;
            }

            const requestFn = isB2BUser ? updateB2BAccountSettings : updateBCAccountSettings;

            const newParams: CustomFieldItems = {
              ...param,
              currentPassword: param.currentPassword,
            };

            if (param.newPassword === '' && param.confirmPassword === '') {
              delete newParams.newPassword;
              delete newParams.confirmPassword;
            }
            await requestFn(newParams);
          } else if (!termsUpdated) {
            snackbar.success(b3Lang('accountSettings.notification.noEdits'));
            return;
          } else {
            snackbar.success(b3Lang('accountSettings.notification.detailsUpdated'));
            return;
          }

          if (
            (data.password && data.currentPassword) ||
            customer.emailAddress !== trim(data.email)
          ) {
            navigate('/login?loginFlag=3');
          } else {
            B3SStorage.clear();
            setIsFinshUpdate(true);
            window.location.reload();
          }
        }
      } finally {
        setLoadding(false);
      }
    })();
  };

  const FormControl = styled(Box)(({ theme }) => ({
    marginBottom: theme.spacing(2),
    '& .MuiFormLabel-root': {
      marginBottom: '5px',
      display: 'block',
    },
    '& .MuiTextField-root': {
      width: '100%',
    },
    '& input, & .MuiFormControl-root .MuiTextField-root, & .MuiSelect-select.MuiSelect-filled, & .MuiTextField-root .MuiInputBase-multiline':
      {
        backgroundColor: b3HexToRgb('#FFFFFF', 0.87),
        borderRadius: '4px',
        borderBottomLeftRadius: '0',
        borderBottomRightRadius: '0',
      },
  }));

  return (
    <B3Spin isSpinning={isloadding} background={backgroundColor}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          gap: '3rem',
        }}
      >
        <Box
          sx={{
            width: `${isMobile ? '100%' : '35%'}`,
            minHeight: `${isMobile ? '800px' : '300px'}`,
            '& input, & .MuiFormControl-root .MuiTextField-root, & .MuiSelect-select.MuiSelect-filled, & .MuiTextField-root .MuiInputBase-multiline':
              {
                bgcolor: b3HexToRgb('#FFFFFF', 0.87),
                borderRadius: '4px',
                borderBottomLeftRadius: '0',
                borderBottomRightRadius: '0',
              },
            '& .MuiButtonBase-root.MuiCheckbox-root:not(.Mui-checked), & .MuiRadio-root:not(.Mui-checked)':
              {
                color: b3HexToRgb(getContrastColor(backgroundColor), 0.6),
              },
            '& .MuiTypography-root.MuiTypography-body1.MuiFormControlLabel-label, & .MuiFormControl-root .MuiFormLabel-root:not(.Mui-focused)':
              {
                color: b3HexToRgb(getContrastColor(backgroundColor), 0.87),
              },
            '& .MuiInputLabel-root.MuiInputLabel-formControl:not(.Mui-focused)': {
              color: b3HexToRgb(getContrastColor('#FFFFFF'), 0.6),
            },
          }}
        >
          <B3CustomForm
            formFields={accountInfoFormFields}
            errors={errors}
            control={control}
            getValues={getValues}
            setValue={setValue}
          />

          <CustomButton
            sx={{
              mt: '28px',
              mb: `${isMobile ? '20px' : '0'}`,
              width: '100%',
              visibility: `${isVisible ? 'visible' : 'hidden'}`,
            }}
            onClick={handleAddUserClick}
            variant="contained"
          >
            {b3Lang('accountSettings.button.saveUpdates')}
          </CustomButton>
        </Box>

        {isB2BUser && (
          <Box sx={{ width: '400px' }}>
            <FormControl>
              <FormLabel>Company logo:</FormLabel>
              {companyLogo && (
                <Box
                  sx={{
                    mb: 2,
                    borderRadius: '4px',
                    overflow: 'hidden',
                    '& img': {
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      backgroundColor: b3HexToRgb('#FFFFFF', 0.87),
                    },
                  }}
                >
                  <img
                    src={companyLogo}
                    alt="Company Logo"
                    style={{
                      maxWidth: '400px',
                      maxHeight: '400px',
                    }}
                  />
                </Box>
              )}
              <FormLabel>Upload new logo:</FormLabel>
              <FileUpload
                fileList={[]}
                allowUpload
                fileNumber={1}
                maxFileSize={5242880}
                acceptedFiles={['image/*']}
                requestType="companyAttachedFile"
                tips="Upload an image, preferably at least 400px height or width (max 5MB file size)"
                onchange={async (fileObj) => {
                  if (fileObj?.fileUrl) {
                    snackbar.success('Logo uploaded successfully.');
                    setCompanyLogo(fileObj.fileUrl);
                    B3Request.put(
                      `/api/v2/companies/${companyId}/basic-info`,
                      RequestType.B2BRest,
                      {
                        extraFields: [
                          {
                            fieldName: 'Logo URL',
                            fieldValue: fileObj.fileUrl,
                          },
                        ],
                      },
                    );
                  } else snackbar.error(b3Lang('intl.global.fileUpload.fileUploadFailure'));
                }}
              />
            </FormControl>
            <FormControl sx={{ marginTop: '3rem' }}>
              <Controller
                name="companyTerms"
                control={control}
                defaultValue={companyTerms}
                render={({ field }) => (
                  <TextField
                    {...field}
                    onBlur={() => {
                      if (!termsUpdated) setTermsUpdated(true);
                      setCompanyTerms(field.value);
                    }}
                    label="Terms & Conditions"
                    multiline
                    rows={8}
                    variant="filled"
                  />
                )}
              />
            </FormControl>
          </Box>
        )}
      </Box>
    </B3Spin>
  );
}

export default AccountSetting;
