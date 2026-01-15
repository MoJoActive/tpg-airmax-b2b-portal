import { useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useB3Lang } from '@b3/lang';
import { ArrowBackIosNew } from '@mui/icons-material';
import { Box, FormControlLabel, Grid, styled, Switch, Typography, useTheme } from '@mui/material';
import html2pdf from 'html2pdf.js';

import CustomButton from '@/components/button/CustomButton';
import { b3HexToRgb, getContrastColor } from '@/components/outSideComponents/utils/b3CustomStyles';
import { useMobile } from '@/hooks';
import { CustomStyleContext } from '@/shared/customStyleButton';
import { useAppSelector } from '@/store';
import { displayFormat, snackbar } from '@/utils';

import QuoteStatus from './QuoteStatus';

const StyledCreateName = styled('div')(() => ({
  display: 'flex',
  alignItems: 'center',
  marginTop: '0.5rem',
}));

interface QuoteDetailHeaderProps {
  status: string;
  quoteNumber: string;
  issuedAt: number;
  expirationDate: number;
  exportPdf: () => void;
  printQuote: () => Promise<void>;
  role: string | number;
  quoteTitle: string;
  salesRepInfo: { [key: string]: string };
  companyLogo: string;
  showRetailQuote: boolean;
  setShowRetailQuote: (show: boolean) => void;
  isRequestLoading: boolean;
  setIsRequestLoading: (loading: boolean) => void;
}

function QuoteDetailHeader(props: QuoteDetailHeaderProps) {
  const iframeDocument = useAppSelector((state) => state.theme.themeFrame);
  const logoRef = useRef<HTMLImageElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isMobile] = useMobile();
  const b3Lang = useB3Lang();

  /*
  // convert company logo to base64 on page load to ensure it prints
  const [b64Logo, setB64Logo] = useState('');
  useEffect(() => {
    if (!logoRef.current) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    canvas.width = logoRef.current.naturalWidth;
    canvas.height = logoRef.current.naturalHeight;
    ctx.drawImage(logoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    setB64Logo(dataUrl);
  }, [logoRef.current]);
  */

  const {
    status,
    quoteNumber,
    issuedAt,
    expirationDate,
    role,
    quoteTitle,
    salesRepInfo,
    companyLogo,
    showRetailQuote,
    setShowRetailQuote,
    isRequestLoading,
    setIsRequestLoading,
  } = props;

  // hardcode all the CSS piecemeal
  const applyComputedStyles = (sourceElement: Element, targetElement: Element) => {
    const el = targetElement as HTMLElement;
    const computed = window.getComputedStyle(sourceElement);

    Array.from(computed).forEach((style: string) => {
      try {
        // @ts-expect-error CSS style assignment
        el.style[style as keyof CSSStyleDeclaration] = computed.getPropertyValue(style);
      } catch {
        /* ignore read-only properties */
      }
    });

    Array.from(sourceElement.children).forEach((child: Element, index: number) => {
      if (targetElement.children[index]) applyComputedStyles(child, targetElement.children[index]);
    });

    // prevent text wrapping
    // except on quote-info header, terms, notes, shipping options, product titles
    if (
      !el.matches('#quote-info *, #quote-terms *, #quote-notes *, #shipping-options *, .css-xj83u6')
    )
      el.style.whiteSpace = 'nowrap';
  };

  // doctor front-end elements for retail quote
  useEffect(() => {
    const selectBox = iframeDocument
      ? iframeDocument.querySelectorAll(
          '#quote-table .MuiTablePagination-selectLabel,' +
            '#quote-table .MuiTablePagination-input',
        )
      : null;

    const paginators = iframeDocument
      ? iframeDocument.querySelectorAll('#quote-table .MuiTablePagination-actions')
      : null;

    selectBox?.forEach((el: HTMLElement | Element) => {
      const element = el as HTMLElement;
      if (isPrinting) element.style.opacity = '0';
      else element.style.opacity = '1';
    });

    paginators?.forEach((el: HTMLElement | Element) => {
      const element = el as HTMLElement;
      if (isPrinting) element.style.display = 'none';
      else element.style.display = 'block';
    });
  }, [isPrinting, iframeDocument]);

  const exportPdf = async (isRetail: boolean) => {
    if (!iframeDocument) {
      snackbar.error('Could not access document.');
      return;
    }

    const elementToExport = iframeDocument.querySelector('#quote-detail-container') as HTMLElement;
    if (!elementToExport) {
      snackbar.error('Could not find element to export.');
      return;
    }

    // 8.5" at 300dpi
    const pxWidth = 2550;

    const shouldShowRetailQuote = showRetailQuote;
    setIsRequestLoading(true);
    setIsPrinting(true);
    setShowRetailQuote(isRetail);

    // give time to render
    await new Promise((resolve) => {
      setTimeout(resolve, 250);
    });

    const clonedElement = elementToExport.cloneNode(true) as HTMLElement;
    clonedElement.style.cssText = `
      background: #ccc;
      width: ${pxWidth}px;
      max-width: ${pxWidth}px;
      margin: 0 auto;
      padding: 0;
      overflow: hidden;
      position: relative;
      box-sizing: border-box;
    `;

    try {
      applyComputedStyles(elementToExport, clonedElement);
      setShowRetailQuote(shouldShowRetailQuote);

      const options = {
        margin: 20,
        filename: `${isRetail ? 'Customer' : 'Internal'} Quote ${quoteNumber}.pdf`,
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: true,
          width: pxWidth,
          windowWidth: pxWidth,
          allowTaint: true,
          imageTimeout: 5000,
        },
        jsPDF: {
          unit: 'px',
          format: 'letter',
          orientation: 'portrait',
          putOnlyUsedFonts: true,
          compress: true,
        },
      };

      await html2pdf(clonedElement, options);
    } catch (err) {
      snackbar.error('Failed to generate PDF.');
    } finally {
      setIsPrinting(false);
      setShowRetailQuote(shouldShowRetailQuote);
      setIsRequestLoading(false);
    }
  };

  const {
    state: {
      portalStyle: { backgroundColor = '#FEF9F5' },
    },
  } = useContext(CustomStyleContext);

  const customColor = getContrastColor(backgroundColor);

  const theme = useTheme();

  const primaryColor = theme.palette.primary.main;

  const navigate = useNavigate();
  const gridOptions = (xs: number) =>
    isMobile
      ? {}
      : {
          xs,
        };

  return (
    <>
      {!isPrinting && +role !== 100 && (
        <Box
          sx={{
            width: 'fit-content',
            displayPrint: 'none',
          }}
        >
          <Box
            sx={{
              color: '#1976d2',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              position: 'relative',
              zIndex: 2,
            }}
            onClick={() => {
              navigate('/quotes');
            }}
          >
            <ArrowBackIosNew
              fontSize="small"
              sx={{
                fontSize: '12px',
                marginRight: '0.5rem',
                color: primaryColor,
              }}
            />
            <p
              style={{
                color: primaryColor,
                margin: '0',
              }}
            >
              {b3Lang('quoteDetail.header.backToQuoteLists')}
            </p>
          </Box>
        </Box>
      )}

      <Grid
        container
        spacing={2}
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          width: '100%',
          flexDirection: `${isMobile ? 'column' : 'row'}`,
          mb: `${isMobile ? '16px' : ''}`,
          flexFlow: 'nowrap',
        }}
      >
        <Grid
          item
          {...gridOptions(8)}
          sx={{
            color: customColor,
            paddingTop: isPrinting ? '0' : '3rem !important',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: `${isMobile ? 'start' : 'center'}`,
              flexDirection: `${isMobile ? 'column' : 'row'}`,
            }}
          >
            <Typography
              sx={{
                marginRight: '10px',
                fontSize: '34px',
                color: b3HexToRgb(customColor, 0.87),
              }}
            >
              {showRetailQuote ? 'Customer ' : 'Internal '}
              {b3Lang('quoteDetail.header.quoteNumber', {
                quoteNumber: quoteNumber || '',
              })}
            </Typography>

            <QuoteStatus code={status} />
          </Box>
          {quoteTitle && (
            <StyledCreateName>
              <Typography
                variant="subtitle2"
                sx={{
                  marginRight: '0.5rem',
                  fontSize: '16px',
                }}
              >
                {b3Lang('quoteDetail.header.title')}
              </Typography>
              <span>{quoteTitle}</span>
            </StyledCreateName>
          )}
          {(salesRepInfo?.salesRepName || salesRepInfo?.salesRepEmail) && (
            <StyledCreateName>
              <Typography
                variant="subtitle2"
                sx={{
                  marginRight: '0.5rem',
                  fontSize: '16px',
                }}
              >
                {b3Lang('quoteDetail.header.salesRep')}
              </Typography>
              <span>
                {salesRepInfo?.salesRepEmail !== ''
                  ? `${salesRepInfo?.salesRepName}(${salesRepInfo?.salesRepEmail})`
                  : salesRepInfo?.salesRepName}
              </span>
            </StyledCreateName>
          )}
          <Box>
            <StyledCreateName>
              <Typography
                variant="subtitle2"
                sx={{
                  marginRight: '0.5rem',
                  fontSize: '16px',
                }}
              >
                {b3Lang('quoteDetail.header.issuedOn')}
              </Typography>
              <span>{`${issuedAt ? displayFormat(+issuedAt) : ''}`}</span>
            </StyledCreateName>
            <StyledCreateName>
              <Typography
                variant="subtitle2"
                sx={{
                  marginRight: '0.5rem',
                  fontSize: '16px',
                }}
              >
                {b3Lang('quoteDetail.header.expirationDate')}
              </Typography>
              <span>{`${expirationDate ? displayFormat(+expirationDate) : ''}`}</span>
            </StyledCreateName>
          </Box>
        </Grid>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: '1rem',
            marginRight: '-1rem',
            marginTop: '-1rem',
          }}
        >
          {!isRequestLoading && +role !== 100 && (
            <Grid
              item
              sx={{
                alignSelf: 'flex-end',
                maxWidth: '100% !important',
                textAlign: `${isMobile ? 'none' : 'end'}`,
                displayPrint: 'none',
              }}
              {...gridOptions(4)}
            >
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '1.5rem',
                }}
              >
                <FormControlLabel
                  label={
                    <Typography
                      variant="body2"
                      sx={{ display: 'inline', whiteSpace: 'nowrap', userSelect: 'none' }}
                    >
                      Show customer quote
                    </Typography>
                  }
                  control={
                    <Switch
                      checked={showRetailQuote}
                      onChange={(event) => setShowRetailQuote(event.target.checked)}
                      name="showRetailQuote"
                      color="primary"
                    />
                  }
                  sx={{
                    margin: '0',
                    display: 'flex',
                    width: '100%',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                />
                <CustomButton
                  variant="outlined"
                  onClick={() => exportPdf(false)}
                  sx={{
                    whiteSpace: 'nowrap',
                    width: '100%;',
                  }}
                >
                  Download Internal PDF
                </CustomButton>
                <CustomButton
                  variant="contained"
                  onClick={() => exportPdf(true)}
                  sx={{
                    whiteSpace: 'nowrap',
                    width: '100%;',
                  }}
                >
                  {b3Lang('quoteDetail.header.downloadPDF')}
                </CustomButton>
              </Box>
            </Grid>
          )}

          {companyLogo && (
            <Box
              sx={{
                alignSelf: 'flex-end',
                marginTop: isPrinting ? '0' : '-1rem',
                opacity: 1,
              }}
            >
              <img
                ref={logoRef}
                src={companyLogo}
                alt="Company Logo"
                crossOrigin="anonymous"
                style={{
                  maxWidth: '400px',
                  maxHeight: '400px',
                  position: 'relative',
                  top: isPrinting || isRequestLoading ? '1.75rem' : '0',
                }}
              />
            </Box>
          )}
        </Box>
      </Grid>
    </>
  );
}

export default QuoteDetailHeader;
