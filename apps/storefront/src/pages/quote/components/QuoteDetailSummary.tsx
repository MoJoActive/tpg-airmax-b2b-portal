import { useEffect, useState } from 'react';
import { useB3Lang } from '@b3/lang';
import {
  Box,
  Card,
  CardContent,
  FormControlLabel,
  Grid,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material';

import { createCartHeadless } from '@/shared/service/bc/api/cart';
import { createNewCart, deleteCart, getCart } from '@/shared/service/bc/graphql/cart';
import { useAppSelector } from '@/store';
import { currencyFormatConvert } from '@/utils';

interface Summary {
  originalSubtotal: string | number;
  discount: string | number;
  tax: string | number;
  shipping: string | number;
  totalAmount: string | number;
}

interface QuoteDetailSummaryProps {
  quoteSummary: Summary;
  quoteDetailTax: number;
  status: string;
  quoteDetail: CustomFieldItems;
  isHideQuoteCheckout: boolean;
  showRetailQuote: boolean;
}

interface CartItem {
  itemId: number;
  productId: number;
  quantity: number;
  variantId: number;
  productEntityId: number;
  variantEntityId: number;
}

interface ShippingOption {
  id: string;
  description: string;
  cost: number;
  isRecommended: boolean;
}

interface ShippingAddress {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  address1: string;
  address2: string;
  city: string;
  stateOrProvinceCode: string;
  countryCode: string;
  postalCode: string;
}

export default function QuoteDetailSummary({
  quoteSummary: { originalSubtotal, discount, tax, /* shipping, */ totalAmount },
  quoteDetailTax = 0,
  status,
  quoteDetail,
  isHideQuoteCheckout,
  showRetailQuote,
}: QuoteDetailSummaryProps) {
  const b3Lang = useB3Lang();
  const enteredInclusiveTax = useAppSelector(
    ({ storeConfigs }) => storeConfigs.currencies.enteredInclusiveTax,
  );
  const showInclusiveTaxPrice = useAppSelector(({ global }) => global.showInclusiveTaxPrice);

  const getCurrentPrice = (price: number, quoteDetailTax: number) => {
    if (enteredInclusiveTax) {
      return showInclusiveTaxPrice ? price : price - quoteDetailTax;
    }
    return showInclusiveTaxPrice ? price + quoteDetailTax : price;
  };

  const priceFormat = (price: number | string) => {
    if (typeof price === 'string' && !parseFloat(price)) return price;

    return `${currencyFormatConvert(price, {
      currency: quoteDetail.currency,
      isConversionRate: false,
      useCurrentCurrency: !!quoteDetail.currency,
    })}`;
  };

  /* retrieving shipping & handling via BC API */

  const [shippingOptions, setShippingOptions] = useState<
    | {
        id: string;
        description: string;
        cost: number;
        isRecommended: boolean;
      }[]
    | null
  >(null);

  const [selectedShippingOption, setSelectedShippingOption] = useState<string | null>(null);

  useEffect(() => {
    const getShippingOptions = async () => {
      if (shippingOptions) return;

      const lineItems = quoteDetail?.productsList?.map((item: CartItem) => ({
        itemId: item.productId,
        productId: item.productId,
        quantity: item.quantity,
        variantId: item.variantId,
      }));

      if (lineItems?.length) {
        const cartInfo = await getCart();
        const originalCartData = cartInfo?.data?.site?.cart;
        const existingCartId = cartInfo?.data?.site?.cart?.entityId;

        if (existingCartId) {
          await deleteCart({
            deleteCartInput: {
              cartEntityId: existingCartId,
            },
          });
        }

        const tempCart: {
          id?: string;
          detail?: string;
        } = await createCartHeadless({
          lineItems,
          shippingAddress: quoteDetail.shippingAddress,
        });

        const includes = 'consignments.availableShippingOptions';
        const billingAddress: ShippingAddress = {
          firstName: quoteDetail.billingAddress.firstName,
          lastName: quoteDetail.billingAddress.lastName,
          email: quoteDetail.billingAddress.email,
          company: quoteDetail.companyId.companyName,
          address1: quoteDetail.billingAddress.address,
          address2: '',
          city: quoteDetail.billingAddress.city,
          stateOrProvinceCode: quoteDetail.billingAddress.stateCode,
          countryCode: quoteDetail.billingAddress.countryCode,
          postalCode: quoteDetail.billingAddress.zipCode,
        };

        const consignmentResponse = await fetch(
          `/api/storefront/checkout/${tempCart.id}/consignments?include=${includes}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([
              {
                shippingAddress: billingAddress,
                lineItems,
              },
            ]),
          },
        );

        const consignmentData = await consignmentResponse.json();

        const shippingOptions = consignmentData.consignments[0].availableShippingOptions.map(
          (option: ShippingOption) => {
            if (option.isRecommended) setSelectedShippingOption(option.id);
            return {
              id: option.id,
              description: option.description,
              cost: option.cost,
              isRecommended: option.isRecommended,
            };
          },
        );

        setShippingOptions(shippingOptions);

        if (tempCart.id) {
          await deleteCart({
            deleteCartInput: {
              cartEntityId: tempCart.id,
            },
          });
        }

        if (originalCartData) {
          const physicalItems = originalCartData.lineItems.physicalItems || [];
          const formattedLineItems = physicalItems.map((item: CartItem) => ({
            quantity: item.quantity,
            productEntityId: item.productEntityId,
            variantEntityId: item.variantEntityId,
            selectedOptions: {
              multipleChoices: [],
              textFields: [],
            },
          }));

          await createNewCart({
            createCartInput: {
              lineItems: formattedLineItems,
            },
          });

          await getCart();
        }
      }
    };

    getShippingOptions();
  }, [quoteDetail, shippingOptions]);

  const showPrice = (price: string | number | null): string | number => {
    if (isHideQuoteCheckout) return b3Lang('quoteDraft.quoteSummary.tbd');
    return price ?? '';
  };

  const subtotalPrice = +originalSubtotal;
  const quotedSubtotal = +originalSubtotal - +discount;

  return (
    <Card>
      <CardContent>
        <Box>
          <Typography variant="h5">{b3Lang('quoteDetail.summary.quoteSummary')}</Typography>
          <Box
            sx={{
              marginTop: '20px',
              color: '#212121',
            }}
          >
            {quoteDetail?.displayDiscount && (
              <Grid
                container
                justifyContent="space-between"
                sx={{
                  margin: '4px 0',
                }}
              >
                <Typography>{b3Lang('quoteDetail.summary.originalSubtotal')}</Typography>
                <Typography>
                  {showPrice(priceFormat(getCurrentPrice(subtotalPrice, quoteDetailTax)))}
                </Typography>
              </Grid>
            )}

            {!quoteDetail?.salesRepEmail && +status === 1 ? null : (
              <Grid
                container
                justifyContent="space-between"
                sx={{
                  margin: '4px 0',
                  display: quoteDetail?.displayDiscount ? '' : 'none',
                }}
              >
                <Typography>{b3Lang('quoteDetail.summary.discountAmount')}</Typography>
                <Typography>
                  {+discount > 0 ? `-${priceFormat(+discount)}` : priceFormat(+discount)}
                </Typography>
              </Grid>
            )}

            <Grid
              container
              justifyContent="space-between"
              sx={{
                margin: '4px 0',
              }}
            >
              <Typography
                sx={{
                  fontWeight: 'bold',
                  color: '#212121',
                }}
              >
                {b3Lang('quoteDetail.summary.quotedSubtotal')}
              </Typography>
              <Typography
                sx={{
                  fontWeight: 'bold',
                  color: '#212121',
                }}
              >
                {showPrice(priceFormat(getCurrentPrice(quotedSubtotal, quoteDetailTax)))}
              </Typography>
            </Grid>

            <Grid
              container
              justifyContent="space-between"
              sx={{
                margin: '4px 0',
              }}
            >
              <Typography>{b3Lang('quoteDetail.summary.tax')}</Typography>
              <Typography>{showPrice(priceFormat(+tax))}</Typography>
            </Grid>
            <Grid
              container
              justifyContent="space-between"
              sx={{
                margin: '4px 0',
              }}
            >
              <Typography
                sx={{
                  maxWidth: '70%',
                  wordBreak: 'break-word',
                }}
              >
                {b3Lang('quoteDetail.summary.shipping')}
              </Typography>
              <Typography>
                {showPrice(
                  priceFormat(
                    shippingOptions?.find((opt) => opt.id === selectedShippingOption)?.cost ??
                      'Calculating...',
                  ),
                )}
              </Typography>
            </Grid>

            {
              // radio buttons for shipping
              !showRetailQuote && shippingOptions && (
                <Grid>
                  <Box sx={{ mt: 3 }}>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '.9rem' }}>
                      Shipping Options:
                    </Typography>
                    <RadioGroup
                      value={selectedShippingOption}
                      onChange={(e) => setSelectedShippingOption(e.target.value)}
                    >
                      {shippingOptions.map((option) => (
                        <FormControlLabel
                          key={option.id}
                          value={option.id}
                          control={<Radio />}
                          label={
                            <Typography variant="body2" color="text.secondary">
                              {option.description} — {priceFormat(option.cost)}
                            </Typography>
                          }
                        />
                      ))}
                    </RadioGroup>
                  </Box>
                </Grid>
              )
            }

            <Grid
              container
              justifyContent="space-between"
              sx={{
                margin: '24px 0 0',
              }}
            >
              <Typography
                sx={{
                  fontWeight: 'bold',
                  color: '#212121',
                }}
              >
                {b3Lang('quoteDetail.summary.grandTotal')}
              </Typography>
              <Typography
                sx={{
                  fontWeight: 'bold',
                  color: '#212121',
                }}
              >
                {showPrice(
                  priceFormat(
                    +totalAmount +
                      +tax +
                      (shippingOptions?.find((opt) => opt.id === selectedShippingOption)?.cost ??
                        0),
                  ),
                )}
              </Typography>
            </Grid>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
