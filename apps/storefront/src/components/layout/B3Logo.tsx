import { useContext } from 'react';
import { Box, ImageListItem } from '@mui/material';

import { STORE_DEFAULT_LOGO } from '@/constants';
import { useMobile } from '@/hooks';
import { GlobaledContext } from '@/shared/global';

export default function B3Logo() {
  const {
    state: { logo },
  } = useContext(GlobaledContext);

  const [isMobile] = useMobile();

  return (
    <Box
      sx={
        isMobile
          ? {
              height: '40px',
              width: '140px',
              '& li': {
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: '1rem',
              },
              '& img': {
                maxHeight: '40px',
                maxWidth: '100%',
              },
            }
          : {
              width: '200px',
              height: '65px',
              display: 'flex',
              alignItems: 'center',
              '& img': {
                maxHeight: '65px',
                // wide logos (Airmax is ~5.6:1) otherwise overflow the 200px column
                // and cover the masquerade company name in the header
                maxWidth: '100%',
              },
            }
      }
    >
      <ImageListItem
        sx={{
          maxWidth: '200px',
          cursor: 'pointer',
          '& .MuiImageListItem-img': {
            objectFit: 'contain',
            width: 'auto',
          },
        }}
        onClick={() => {
          window.location.href = '/';
        }}
      >
        <img src={logo || STORE_DEFAULT_LOGO} alt="logo" />
      </ImageListItem>
    </Box>
  );
}
