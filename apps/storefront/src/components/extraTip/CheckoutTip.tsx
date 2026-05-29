import { useState } from 'react';
import { Dialog, DialogActions, DialogContent } from '@mui/material';

import { CHECKOUT_URL } from '@/constants';
import useMobile from '@/hooks/useMobile';
import { type SetOpenPage } from '@/pages/SetOpenPage';
import { useAppSelector } from '@/store';

import CustomButton from '../button/CustomButton';

interface CheckoutTipProps {
  setOpenPage: SetOpenPage;
  /**
   * Number of companies this SUPER_ADMIN can masquerade as.
   * Dialog renders only when > 1 — a rep with exactly one assigned company
   * cannot "select" anything, so the dialog would be a dead-end.
   *
   * TODO: wire this prop from the parent that renders <CheckoutTip>.
   * The superAdminCompanies GraphQL query in HeadlessController.tsx
   * (getMasqueradeState) already fetches the list — pass `companies.length`
   * down, or add a dedicated store slice entry populated at login time.
   * Until then, pass 0 / omit the prop to suppress the dialog safely.
   */
  companiesCount?: number;
}

function CheckoutTip(props: CheckoutTipProps) {
  const { setOpenPage, companiesCount = 0 } = props;
  const [open, setOpen] = useState<boolean>(true);

  const [isMobile] = useMobile();
  const role = useAppSelector(({ company }) => company.customer.role);

  const isAgenting = useAppSelector(({ b2bFeatures }) => b2bFeatures.masqueradeCompany.isAgenting);

  const { href } = window.location;

  if (!href.includes(CHECKOUT_URL)) return null;

  return (
    role === 3 &&
    !isAgenting &&
    companiesCount > 1 && (
      <Dialog
        sx={{
          zIndex: 99999999993,
          padding: '40px 40px 20px 40px',
        }}
        open={open}
        // Prevent backdrop-click and Escape from dismissing — user must select a company.
        disableEscapeKeyDown
        onClose={() => {}}
        fullScreen={isMobile}
      >
        <DialogContent>Please select a company</DialogContent>
        <DialogActions
          sx={{
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <CustomButton
            onClick={() => {
              setOpen(false);
              setOpenPage({
                isOpen: true,
                openUrl: '/',
              });
            }}
            variant="contained"
          >
            OK
          </CustomButton>
        </DialogActions>
      </Dialog>
    )
  );
}

export default CheckoutTip;
