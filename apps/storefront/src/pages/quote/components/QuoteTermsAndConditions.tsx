import { useState } from 'react';
import { useB3Lang } from '@b3/lang';
import { Box, Card, CardContent, Typography } from '@mui/material';

import { B3CollapseContainer } from '@/components';

interface QuoteTermsAndConditionsProps {
  quoteTerms: string;
}

export default function QuoteTermsAndConditions(props: QuoteTermsAndConditionsProps) {
  const { quoteTerms } = props;
  const [isOpen, setIsOpen] = useState(true);
  const b3Lang = useB3Lang();

  const handleOnChange = (open: boolean) => {
    setIsOpen(open);
  };

  return (
    <Card
      sx={{
        '.MuiCardContent-root': {
          maxHeight: isOpen ? '637px' : 'auto',
        },
      }}
    >
      <CardContent
        sx={{
          p: '16px !important',
        }}
      >
        <B3CollapseContainer
          title={b3Lang('quoteDetail.termsAndConditions')}
          handleOnChange={handleOnChange}
          defaultOpen
        >
          <Box>
            <Typography
              variant="body1"
              sx={{
                padding: '16px 0',
                maxHeight: '545px',
                whiteSpace: 'pre-wrap',
                overflow: 'auto',
              }}
            >
              {quoteTerms}
            </Typography>
          </Box>
        </B3CollapseContainer>
      </CardContent>
    </Card>
  );
}
