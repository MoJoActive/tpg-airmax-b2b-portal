import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useB3Lang } from '@b3/lang';
import { ArrowBackIosNew } from '@mui/icons-material';
import { Box, Grid, styled, Typography, useTheme } from '@mui/material';
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
}

function QuoteDetailHeader(props: QuoteDetailHeaderProps) {
  const iframeDocument = useAppSelector((state) => state.theme.themeFrame);
  const [isMobile] = useMobile();
  const b3Lang = useB3Lang();

  const {
    status,
    quoteNumber,
    issuedAt,
    expirationDate,
    // exportPdf,
    printQuote,
    role,
    quoteTitle,
    salesRepInfo,
    companyLogo,
  } = props;

  const exportPdf = async () => {
    if (!iframeDocument) {
      snackbar.error('Could not access document.');
      return;
    }

    const elementToExport = iframeDocument.querySelector('.css-b95f0i') as HTMLElement;
    if (!elementToExport) {
      snackbar.error('Could not find element to export.');
      return;
    }

    // 8.5" at 300dpi
    const pxWidth = 2550;

    // temporarily hiding elements here and re-revealing after PDF is exported
    // the canvas used for generating the PDF doesn't reflow properly otherwise
    const elementsToHide = elementToExport.querySelectorAll(
      '.css-1shru2k, .css-133bwhb, .css-15ggtf1, .css-vubbuv, .css-rfnosa, .css-for3ya',
    );
    elementsToHide.forEach((el) => {
      (el as HTMLElement).style.display = 'none';
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

    // hardcode all the CSS piecemeal
    const applyComputedStyles = (sourceElement: Element, targetElement: Element) => {
      const el = targetElement as HTMLElement;

      const computed = window.getComputedStyle(sourceElement);

      Array.from(computed).forEach((style: string) => {
        try {
          // @ts-expect-error CSS style assignment
          el.style[style as keyof CSSStyleDeclaration] = computed.getPropertyValue(style);
        } catch {
          // ignore read-only properties
        }
      });

      Array.from(sourceElement.children).forEach((child: Element, index: number) => {
        if (targetElement.children[index])
          applyComputedStyles(child, targetElement.children[index]);
      });

      // prevent text wrapping except on contact/billing/shipping and terms
      if (!el.matches('.css-9l3uo3, .css-qjqsn3')) el.style.whiteSpace = 'nowrap';

      // remove bottom border on product table
      if (el.matches('.css-1xnox0e > tr:last-child > td')) el.style.borderBottom = 'none';

      // reveal logo and adjust positioning
      if (el.matches('.company-logo')) {
        el.style.display = 'block';
        el.style.position = 'relative';
        el.style.top = '20px';
        el.style.left = '-20px';
      }

      // reveal terms
      if (el.matches('.css-my9yfq')) el.style.display = 'block';
    };

    const tempIframe = document.createElement('iframe');

    try {
      applyComputedStyles(elementToExport, clonedElement);
      tempIframe.style.position = 'absolute';
      tempIframe.style.left = '-9999px';
      document.body.appendChild(tempIframe);

      // revealing hidden elements
      elementsToHide.forEach((el) => {
        (el as HTMLElement).style.display = '';
      });

      const iframeDoc = tempIframe.contentDocument!;
      iframeDoc.open();
      iframeDoc.write(`
        <html>
          <body>
            ${clonedElement.outerHTML}
          </body>
        </html>
      `);
      iframeDoc.close();

      const options = {
        margin: 20,
        filename: 'quote.pdf',
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: true,
          width: pxWidth,
          windowWidth: pxWidth,
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
      document.body.removeChild(tempIframe);
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
      {+role !== 100 && (
        <Box
          sx={{
            marginBottom: '10px',
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
          flexDirection: `${isMobile ? 'column' : 'row'}`,
          mb: `${isMobile ? '16px' : ''}`,
        }}
      >
        <Grid
          item
          {...gridOptions(8)}
          sx={{
            color: customColor,
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

        {companyLogo && (
          <Box className="company-logo" sx={{ display: 'none' }}>
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

        {+role !== 100 && (
          <Grid
            item
            sx={{
              textAlign: `${isMobile ? 'none' : 'end'}`,
              displayPrint: 'none',
            }}
            {...gridOptions(4)}
          >
            <Box>
              <CustomButton
                variant="outlined"
                sx={{
                  marginRight: '1rem',
                  displayPrint: 'none',
                }}
                onClick={printQuote}
              >
                {b3Lang('quoteDetail.header.print')}
              </CustomButton>
              <CustomButton variant="outlined" onClick={exportPdf}>
                {b3Lang('quoteDetail.header.downloadPDF')}
              </CustomButton>
            </Box>
          </Grid>
        )}
      </Grid>
    </>
  );
}

export default QuoteDetailHeader;
