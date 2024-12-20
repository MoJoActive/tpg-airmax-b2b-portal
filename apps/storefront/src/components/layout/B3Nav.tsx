import { useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useB3Lang } from '@b3/lang';
import {
  Badge,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  useTheme,
} from '@mui/material';

import { useMobile } from '@/hooks';
import { DynamicallyVariableedContext } from '@/shared/dynamicallyVariable';
import { GlobaledContext } from '@/shared/global';
import { getAllowedRoutes } from '@/shared/routes';
import { useAppSelector } from '@/store';
import { B3SStorage } from '@/utils';

import { b3HexToRgb, getContrastColor } from '../outSideComponents/utils/b3CustomStyles';

interface B3NavProps {
  closeSidebar?: (x: boolean) => void;
}

export default function B3Nav({ closeSidebar }: B3NavProps) {
  const [isMobile] = useMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const b3Lang = useB3Lang();
  const customerGroupId = useAppSelector(({ company }) => company.customer.customerGroupId);

  const { dispatch } = useContext(DynamicallyVariableedContext);
  const role = useAppSelector(({ company }) => company.customer.role);

  const { state: globalState } = useContext(GlobaledContext);
  const { quoteDetailHasNewMessages, registerEnabled } = globalState;

  const theme = useTheme();
  const primaryColor = theme.palette.primary.main;

  const jumpRegister = () => {
    navigate('/register');
    dispatch({
      type: 'common',
      payload: {
        globalMessageDialog: {
          open: false,
          title: '',
          message: '',
          cancelText: 'Cancel',
        },
      },
    });
  };

  const handleClick = (item: { configKey?: string; path: string; isExternal?: boolean }) => {
    if (item.isExternal) {
      window.location.href = window.location.origin + item.path;
      return;
    }

    if (role === 100) {
      dispatch({
        type: 'common',
        payload: {
          globalMessageDialog: {
            open: true,
            title: 'Registration',
            message:
              item.configKey === 'shoppingLists'
                ? 'Please create an account, or login to create a shopping list.'
                : 'To receive full access to buyer portal, please register. It will take 2 minutes.',
            cancelText: 'Cancel',
            saveText: registerEnabled ? 'Register' : '',
            saveFn: jumpRegister,
          },
        },
      });

      return;
    }

    navigate(item.path);
    if (isMobile && closeSidebar) {
      closeSidebar(false);
    }
  };
  const menuItems = () => {
    const newRoutes = getAllowedRoutes(globalState).filter((route) => route.isMenuItem);

    return newRoutes;
  };
  const newRoutes = menuItems();
  const activePath = (path: string) => {
    if (location.pathname === path) {
      B3SStorage.set('prevPath', path);
      return true;
    }

    if (location.pathname.includes('orderDetail')) {
      const gotoOrderPath =
        B3SStorage.get('prevPath') === '/company-orders' ? '/company-orders' : '/orders';
      if (path === gotoOrderPath) return true;
    }

    if (location.pathname.includes('shoppingList') && path === '/shoppingLists') {
      return true;
    }

    if (location.pathname.includes('/quoteDetail') || location.pathname.includes('/quoteDraft')) {
      if (path === '/quotes') return true;
    }

    return false;
  };

  let portalPrefix = '';

  if (customerGroupId === 2) {
    portalPrefix = 'dealer';
  } else if (customerGroupId === 3) {
    portalPrefix = 'pro';
  }

  return (
    <List
      id="b2b-nav"
      sx={{
        width: '100%',
        maxWidth: 360,
        bgcolor: `${isMobile ? 'background.paper' : 'background.default'}`,
        color: primaryColor || 'info.main',
        '& .MuiListItem-root': {
          '& .MuiButtonBase-root.Mui-selected': {
            color: getContrastColor(primaryColor) || '#fff',
            bgcolor: 'primary.main',
            borderRadius: '4px',
          },
          '& .MuiButtonBase-root:hover:not(.Mui-selected)': {
            bgcolor: b3HexToRgb(primaryColor, 0.12),
            borderRadius: '4px',
          },
        },
      }}
      component="nav"
      aria-labelledby="nested-list-subheader"
    >
      {newRoutes.map((item) => {
        if (item.name === 'Quotes') {
          const { pathname } = location;
          return (
            <ListItem key={item.path} disablePadding>
              <Badge
                badgeContent={
                  quoteDetailHasNewMessages && pathname.includes('quoteDetail') ? '' : 0
                }
                variant="dot"
                sx={{
                  width: '100%',
                  '& .MuiBadge-badge.MuiBadge-dot': {
                    width: 8,
                    height: 8,
                    bgcolor: '#FFFFFF',
                    right: 14,
                    top: 22,
                  },
                }}
              >
                <ListItemButton onClick={() => handleClick(item)} selected={activePath(item.path)}>
                  <ListItemText primary={b3Lang(item.idLang)} />
                </ListItemButton>
              </Badge>
            </ListItem>
          );
        }
        return (
          <ListItem key={item.path} disablePadding>
            <ListItemButton onClick={() => handleClick(item)} selected={activePath(item.path)}>
              <ListItemText primary={b3Lang(item.idLang)} />
            </ListItemButton>
          </ListItem>
        );
      })}

      {(customerGroupId === 2 || customerGroupId === 3) && (
        <>
          <Divider id="nav-divider" />

          <ListItem key="marketing-pricing" disablePadding>
            <ListItemButton
              onClick={() =>
                handleClick({
                  path: `/${portalPrefix}-portal/marketing-pricing/`,
                  isExternal: true,
                })
              }
            >
              <ListItemText primary="Marketing & Pricing" />
            </ListItemButton>
          </ListItem>

          <ListItem key="technical-training" disablePadding>
            <ListItemButton
              onClick={() =>
                handleClick({
                  path: `/${portalPrefix}-portal/technical-training/`,
                  isExternal: true,
                })
              }
            >
              <ListItemText primary="Technical Training" />
            </ListItemButton>
          </ListItem>

          <ListItem key="hires-images" disablePadding>
            <ListItemButton
              onClick={() =>
                handleClick({
                  path: `/${portalPrefix}-portal/hires-images/`,
                  isExternal: true,
                })
              }
            >
              <ListItemText primary="Hi-Res Images" />
            </ListItemButton>
          </ListItem>
        </>
      )}
    </List>
  );
}
