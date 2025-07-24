'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, AlertTriangle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

const createBillingGroupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  group_type: z.enum(['standard', 'corporate', 'deposit', 'credit']),
  payer_email: z.string().email('Invalid email').optional().or(z.literal('')),
  payer_organization_id: z.string().uuid().optional().or(z.literal('')),
  credit_limit: z.coerce.number().positive('Must be positive').optional().or(z.literal('')),
  deposit_amount: z.coerce.number().positive('Must be positive').optional().or(z.literal('')),
  notes: z.string().optional(),
})

type CreateBillingGroupForm = z.infer<typeof createBillingGroupSchema>

interface CreateBillingGroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tabId: string
  onCreated: () => void
}

export function CreateBillingGroupDialog({
  open,
  onOpenChange,
  tabId,
  onCreated
}: CreateBillingGroupDialogProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const form = useForm<CreateBillingGroupForm>({
    resolver: zodResolver(createBillingGroupSchema),
    defaultValues: {
      name: '',
      group_type: 'standard',
      payer_email: '',
      payer_organization_id: '',
      credit_limit: '',
      deposit_amount: '',
      notes: '',
    },
  })

  const groupType = form.watch('group_type')

  // Clear error when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setError(null)
      form.reset()
    }
  }, [open, form])

  // Clear error when user starts typing
  const handleFieldChange = () => {
    if (error) {
      setError(null)
    }
  }

  const onSubmit = async (data: CreateBillingGroupForm) => {
    setIsCreating(true)
    setError(null)
    
    try {
      const payload = {
        ...data,
        tab_id: tabId,
        // Remove empty strings
        payer_email: data.payer_email || undefined,
        payer_organization_id: data.payer_organization_id || undefined,
        credit_limit: data.credit_limit || undefined,
        deposit_amount: data.deposit_amount || undefined,
      }

      const response = await fetch('/api/v1/billing-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to create billing group')
      }

      const result = await response.json()
      
      toast({
        title: 'Billing Group Created',
        description: `Successfully created "${data.name}" billing group.`,
      })

      onCreated()
      onOpenChange(false)
      form.reset()
      setError(null)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create billing group'
      setError(errorMessage)
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="create-dialog" className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Billing Group</DialogTitle>
          <DialogDescription>
            Create a new billing group to organize and split charges
          </DialogDescription>
        </DialogHeader>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Group Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., Room Service, Corporate Account" 
                      {...field}
                      onChange={(e) => {
                        field.onChange(e)
                        handleFieldChange()
                      }}
                      disabled={isCreating}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="group_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Group Type</FormLabel>
                  <Select 
                onValueChange={(value) => {
                  field.onChange(value)
                  handleFieldChange()
                }} 
                defaultValue={field.value}
                disabled={isCreating}
              >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a group type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="corporate">Corporate</SelectItem>
                      <SelectItem value="deposit">Deposit</SelectItem>
                      <SelectItem value="credit">Credit</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose the type of billing group based on payment method
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="payer_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payer Email</FormLabel>
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="john@company.com" 
                      {...field}
                      onChange={(e) => {
                        field.onChange(e)
                        handleFieldChange()
                      }}
                      disabled={isCreating}
                    />
                  </FormControl>
                  <FormDescription>
                    Email address of the person or entity responsible for payment
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {groupType === 'corporate' && (
              <FormField
                control={form.control}
                name="payer_organization_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization ID</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Organization UUID" 
                        {...field}
                        onChange={(e) => {
                          field.onChange(e)
                          handleFieldChange()
                        }}
                        disabled={isCreating}
                      />
                    </FormControl>
                    <FormDescription>
                      ID of the organization responsible for payment
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {groupType === 'credit' && (
              <FormField
                control={form.control}
                name="credit_limit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Credit Limit</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="1000.00"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e)
                          handleFieldChange()
                        }}
                        disabled={isCreating}
                      />
                    </FormControl>
                    <FormDescription>
                      Maximum credit amount allowed for this group
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {groupType === 'deposit' && (
              <FormField
                control={form.control}
                name="deposit_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deposit Amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="500.00"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e)
                          handleFieldChange()
                        }}
                        disabled={isCreating}
                      />
                    </FormControl>
                    <FormDescription>
                      Prepaid deposit amount available for this group
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes about this billing group..."
                      className="resize-none"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e)
                        handleFieldChange()
                      }}
                      disabled={isCreating}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button data-testid="create-group" type="submit" disabled={isCreating}>
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Group
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}