import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'

import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'

import styled from '@emotion/styled'

import {
  B3Tag,
} from '@/components/B3Tag'

import {
  UsersList,
  getUserRole,
} from './config'

interface RoleListProps {
  label: string,
  value: string | number,
  color: string,
  textColor: string,
}

export interface OrderItemCardProps {
  item: UsersList,
  onEdit: (data: UsersList) => void
  onDelete: (data: UsersList) => void
}

const Flex = styled('div')(() => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}))

export const UserItemCard = (props: OrderItemCardProps) => {
  const {
    item: userInfo,
    onEdit,
    onDelete,
  } = props

  const getNewRoleList = () => {
    const userRole = getUserRole()
    const newRoleList: Array<RoleListProps> = userRole.map((item) => {
      if (+item.value === 0) {
        return {
          color: '#C4DD6C',
          textColor: 'black',
          ...item,
        }
      }
      if (+item.value === 1) {
        return {
          color: 'rgba(237, 108, 2, 0.3)',
          textColor: 'black',
          ...item,
        }
      }
      return {
        color: '#D9DCE9',
        textColor: 'black',
        ...item,
      }
    })

    return newRoleList
  }

  const statusRender = (role: number) => {
    const newRoleList = getNewRoleList()
    const roleItem = newRoleList.find((item: RoleListProps) => +item.value === +role)

    if (!roleItem) return
    return (
      <B3Tag
        color={roleItem.color}
        textColor={roleItem.textColor}
      >
        {roleItem.label}
      </B3Tag>
    )
  }

  return (
    <Card
      key={userInfo.id}
    >
      <CardContent
        sx={{
          color: '#313440',
        }}
      >
        <Typography
          variant="h5"
          sx={{
            color: 'rgba(0, 0, 0, 0.87)',
          }}
        >
          {userInfo.firstName}
          {' '}
          {userInfo.lastName}
        </Typography>

        <Typography
          sx={{
            p: '15px 0',
          }}
          variant="body1"
        >
          {userInfo.email}

        </Typography>
        <Flex>
          {statusRender(userInfo.role)}
          <Box>
            <IconButton
              aria-label="edit"
              size="small"
              sx={{
                marginRight: '8px',
              }}
              onClick={() => { onEdit(userInfo) }}
            >
              <EditIcon fontSize="inherit" />
            </IconButton>
            <IconButton
              aria-label="delete"
              size="small"
              onClick={() => { onDelete(userInfo) }}
            >
              <DeleteIcon fontSize="inherit" />
            </IconButton>
          </Box>
        </Flex>
      </CardContent>
    </Card>
  )
}
