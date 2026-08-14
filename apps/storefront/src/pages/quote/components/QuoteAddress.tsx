import { forwardRef, Ref, useEffect, useImperativeHandle, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useB3Lang } from '@b3/lang';
import { Box, Typography } from '@mui/material';
import cloneDeep from 'lodash-es/cloneDeep';

import { B3CustomForm } from '@/components';
import { useGetCountry, useMobile } from '@/hooks';
import { AddressItemType } from '@/types/address';
import { BillingAddress, ContactInfo, ShippingAddress } from '@/types/quotes';

import { deCodeField } from '../../Registered/config';
import { QuoteAddressFormField } from '../config';

import ChooseAddress from './ChooseAddress';

type AddressItemProps = {
  node: AddressItemType;
};

interface AddressProps {
  title: string;
  pr?: string | number;
  pl?: string | number;
  addressList?: AddressItemProps[];
  info: ContactInfo | ShippingAddress | BillingAddress;
  role: string | number;
  accountFormFields: QuoteAddressFormField[];
  shippingSameAsBilling: boolean;
  type: string;
  setBillingChange: (value: boolean) => void;
}

export interface QuoteAddressRef {
  getContactInfoValue: () => ShippingAddress & BillingAddress;
  setShippingInfoValue: (address: CustomFieldItems) => void;
  validate: () => Promise<boolean>;
}

export interface FormFieldsProps {
  name: string;
  label?: string;
  required?: boolean;
  fieldType?: string;
  default?: string | number | Array<string | number>;
  xs: number;
  variant: string;
  size: string;
  options?: Array<Record<string, string | number>>;
  replaceOptions?: {
    label: string;
    value: string;
  };
  [key: string]: unknown;
}

export interface Country {
  countryCode: string;
  countryName: string;
  id?: string;
  states: [];
}
export interface State {
  stateCode?: string;
  stateName?: string;
  id?: string;
}

function QuoteAddress(
  {
    title,
    addressList = [],
    pr = 0,
    pl = 0,
    info,
    role,
    accountFormFields = [],
    shippingSameAsBilling = false,
    type,
    setBillingChange,
  }: AddressProps,
  ref: Ref<QuoteAddressRef>,
) {
  const {
    control,
    getValues,
    formState: { errors },
    setValue,
    trigger,
  } = useForm({
    mode: 'onSubmit',
  });

  const [isMobile] = useMobile();
  const b3Lang = useB3Lang();

  type InfoKeys = keyof typeof info;

  const [isOpen, setOpen] = useState<boolean>(false);
  const [quoteAddress, setQuoteAddress] = useState<QuoteAddressFormField[]>(
    cloneDeep(accountFormFields),
  );

  useGetCountry({
    control,
    setValue,
    getValues,
    setAddress: (fields) => setQuoteAddress(fields as QuoteAddressFormField[]),
    addresses: quoteAddress as FormFieldsProps[],
  });

  const applyExtraFields = (
    extraFields: { fieldName: string; fieldValue: string }[] = [],
    fields: QuoteAddressFormField[] = accountFormFields,
  ) => {
    fields
      .filter((field) => field.custom)
      .forEach((field) => {
        const match = extraFields.find((item) => item.fieldName === deCodeField(field.name));
        setValue(field.name, match?.fieldValue || field.default || '');
      });
  };

  const getContactInfoValue = () => getValues() as ShippingAddress & BillingAddress;
  const setShippingInfoValue = (address: CustomFieldItems) => {
    const addressKey = Object.keys(address);

    addressKey.forEach((item: string) => {
      if (item === 'company' || item === 'extraFields') return;
      setValue(item, address[item]);
    });

    if (Array.isArray(address.extraFields)) {
      applyExtraFields(address.extraFields);
    }
  };

  useImperativeHandle(ref, () => ({
    getContactInfoValue,
    setShippingInfoValue,
    validate: () => trigger(),
  }));

  const handleAddressChoose = () => {
    setOpen(true);
  };

  const handleCloseAddressChoose = () => {
    setOpen(false);
  };

  const handleChangeAddress = (address: AddressItemType) => {
    const addressItem: Record<string, string> = {
      label: address?.label || '',
      firstName: address?.firstName || '',
      lastName: address?.lastName || '',
      company: address?.company || '',
      country: address?.countryCode || '',
      address: address?.addressLine1 || '',
      apartment: address?.addressLine2 || '',
      city: address?.city || '',
      state: address?.state || '',
      zipCode: address?.zipCode || '',
      phoneNumber: address?.phoneNumber || '',
    };

    Object.keys(addressItem).forEach((item: string) => {
      if (item === 'company') return;
      setValue(item, addressItem[item]);
    });

    applyExtraFields(address?.extraFields || []);

    if (type === 'billing' && shippingSameAsBilling) {
      setBillingChange(true);
    }

    handleCloseAddressChoose();
  };

  useEffect(() => {
    setQuoteAddress(cloneDeep(accountFormFields));
  }, [accountFormFields]);

  useEffect(() => {
    if (JSON.stringify(info) !== '{}') {
      Object.keys(info).forEach((item: string) => {
        if (item === 'extraFields') return;
        setValue(item, info[item as InfoKeys]);
      });

      applyExtraFields((info as ShippingAddress | BillingAddress).extraFields || []);
    }
    // Disabling this rule as dispatcher dep setValue is the same between renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info, accountFormFields]);

  return (
    <Box width={isMobile ? '100%' : '50%'} mt={isMobile ? '2rem' : '0'} pr={pr} pl={pl}>
      <Box
        sx={{
          display: 'flex',
          mb: '20px',
        }}
      >
        <Typography
          sx={{
            fontWeight: 400,
            fontSize: '24px',
            height: '32px',
            mr: '16px',
          }}
        >
          {title}
        </Typography>
        {+role !== 100 && (
          <Typography
            onClick={handleAddressChoose}
            sx={{
              fontWeight: 500,
              fontSize: '14px',
              color: 'primary.main',
              display: 'flex',
              alignItems: 'flex-end',
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            {b3Lang('quoteDraft.quoteAddress.chooseFromSaved')}
          </Typography>
        )}
      </Box>

      <B3CustomForm
        formFields={quoteAddress}
        errors={errors}
        control={control}
        getValues={getValues}
        setValue={setValue}
      />

      <ChooseAddress
        isOpen={isOpen}
        handleChangeAddress={handleChangeAddress}
        closeModal={handleCloseAddressChoose}
        addressList={addressList}
        type={type}
      />
    </Box>
  );
}

export default forwardRef(QuoteAddress);
