'use client'

import React, { Fragment } from 'react'
import { Menu, Transition } from '@headlessui/react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UserMenuItem {
  label: string
  onClick: () => void
  icon?: React.ReactNode
  divider?: boolean
}

interface UserMenuProps {
  user: {
    name: string
    email?: string
    avatar?: string
    initials?: string
  }
  items: UserMenuItem[]
  className?: string
}

export function UserMenu({ user, items, className }: UserMenuProps) {
  return (
    <Menu as="div" className={cn('relative', className)}>
      <Menu.Button className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-gray-50 transition-colors">
        {user.avatar ? (
          <img
            className="h-8 w-8 rounded-full"
            src={user.avatar}
            alt={user.name}
          />
        ) : (
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-500">
            <span className="text-sm font-medium leading-none text-white">
              {user.initials || user.name.charAt(0).toUpperCase()}
            </span>
          </span>
        )}
        <div className="hidden md:block text-left">
          <p className="text-sm font-medium text-gray-900">{user.name}</p>
          {user.email && (
            <p className="text-xs text-gray-500">{user.email}</p>
          )}
        </div>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </Menu.Button>
      
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          {items.map((item, index) => (
            <Fragment key={index}>
              {item.divider && index > 0 && (
                <div className="my-1 h-px bg-gray-200" />
              )}
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={item.onClick}
                    className={cn(
                      'flex w-full items-center gap-2 px-4 py-2 text-sm',
                      active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                    )}
                  >
                    {item.icon && (
                      <span className="text-gray-400">{item.icon}</span>
                    )}
                    {item.label}
                  </button>
                )}
              </Menu.Item>
            </Fragment>
          ))}
        </Menu.Items>
      </Transition>
    </Menu>
  )
}