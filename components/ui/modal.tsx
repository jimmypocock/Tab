import React, { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ModalProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
}

const Modal: React.FC<ModalProps> = ({ open, onClose, children, className }) => {
  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel 
                className={cn(
                  'relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg',
                  className
                )}
              >
                {children}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}

const ModalTrigger: React.FC<{ children: React.ReactNode; onClick: () => void }> = ({ children, onClick }) => {
  return (
    <div onClick={onClick}>
      {children}
    </div>
  )
}

const ModalContent: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  return (
    <div className={cn('px-4 pb-4 pt-5 sm:p-6', className)}>
      {children}
    </div>
  )
}

const ModalHeader: React.FC<{ children: React.ReactNode; className?: string; onClose?: () => void }> = ({ 
  children, 
  className,
  onClose 
}) => {
  return (
    <div className={cn('flex items-start justify-between', className)}>
      <div className="flex-1">
        {children}
      </div>
      {onClose && (
        <button
          type="button"
          className="ml-3 inline-flex items-center justify-center rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          onClick={onClose}
        >
          <span className="sr-only">Close</span>
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

const ModalTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  return (
    <Dialog.Title as="h3" className={cn('text-lg font-semibold leading-6 text-gray-900', className)}>
      {children}
    </Dialog.Title>
  )
}

const ModalDescription: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  return (
    <Dialog.Description className={cn('mt-2 text-sm text-gray-500', className)}>
      {children}
    </Dialog.Description>
  )
}

const ModalFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  return (
    <div className={cn('mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-2', className)}>
      {children}
    </div>
  )
}

export { Modal, ModalTrigger, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter }