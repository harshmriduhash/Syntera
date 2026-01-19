"use client"

import { useDeal, useUpdateDeal, useContacts } from '@/lib/api/crm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { useEffect } from 'react'

type DealFormData = {
  title: string
  contact_id?: string
  value?: string
  stage?: 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'closed-won' | 'closed-lost'
  probability?: string
  expected_close_date?: string
  metadata?: string
}

export default function EditDealPage() {
  const params = useParams()
  const router = useRouter()
  const dealId = params.id as string
  const { data, isLoading } = useDeal(dealId)
  const { data: contactsData } = useContacts({ limit: 100 })
  const updateDeal = useUpdateDeal()

  const deal = data?.deal
  const contacts = contactsData?.contacts || []

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DealFormData>({
    defaultValues: {
      title: '',
    },
  })

  useEffect(() => {
    if (deal) {
      reset({
        title: deal.title,
        contact_id: deal.contact_id || undefined,
        value: deal.value?.toString() || '',
        stage: deal.stage,
        probability: deal.probability?.toString() || '0',
        expected_close_date: deal.expected_close_date
          ? new Date(deal.expected_close_date).toISOString().split('T')[0]
          : '',
        metadata: deal.metadata ? JSON.stringify(deal.metadata, null, 2) : '',
      })
    }
  }, [deal, reset])

  const selectedContactId = watch('contact_id')

  const onSubmit = async (data: DealFormData) => {
    try {
      // Validate required fields
      if (!data.title || data.title.trim() === '') {
        return // You could show an error toast here if needed
      }

      let metadata = {}
      if (data.metadata) {
        try {
          metadata = JSON.parse(data.metadata)
        } catch {
          // If not valid JSON, ignore
        }
      }

      await updateDeal.mutateAsync({
        id: dealId,
        data: {
          title: data.title,
          contact_id: data.contact_id || undefined,
          value: data.value ? parseFloat(data.value) : undefined,
          stage: data.stage || 'lead',
          probability: data.probability ? parseInt(data.probability) : 0,
          expected_close_date: data.expected_close_date || undefined,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        },
      })

      router.push(`/dashboard/crm/deals/${dealId}`)
    } catch (error) {
      // Error handled by React Query mutation
    }
  }

  const getContactName = (contact: typeof contacts[0]) => {
    if (contact.first_name || contact.last_name) {
      return `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
    }
    return contact.email || contact.phone || 'Unnamed Contact'
  }

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!deal) {
    return (
      <div className="space-y-6">
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="text-destructive">Deal not found.</p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/crm/deals">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Deals
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center gap-4"
      >
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/crm/deals/${dealId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="space-y-1">
          <h1 className="text-4xl font-bold tracking-tight">Edit Deal</h1>
          <p className="text-muted-foreground text-lg">Update deal information</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Deal Information</CardTitle>
            <CardDescription>Update the deal details below</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Deal Title *</Label>
                <Input
                  id="title"
                  {...register('title')}
                  placeholder="Q4 Enterprise License"
                />
                {errors.title && (
                  <p className="text-sm text-destructive">{errors.title.message}</p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contact_id">Contact</Label>
                  <Select
                    value={selectedContactId || undefined}
                    onValueChange={(value) => setValue('contact_id', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a contact (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {contacts.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {getContactName(contact)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="value">Deal Value ($)</Label>
                  <Input
                    id="value"
                    type="number"
                    step="0.01"
                    {...register('value')}
                    placeholder="50000"
                  />
                  {errors.value && (
                    <p className="text-sm text-destructive">{errors.value.message}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="stage">Stage</Label>
                  <Select
                    value={watch('stage') || 'lead'}
                    onValueChange={(value) => setValue('stage', value as DealFormData['stage'])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="qualified">Qualified</SelectItem>
                      <SelectItem value="proposal">Proposal</SelectItem>
                      <SelectItem value="negotiation">Negotiation</SelectItem>
                      <SelectItem value="closed-won">Closed Won</SelectItem>
                      <SelectItem value="closed-lost">Closed Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="probability">Win Probability (%)</Label>
                  <Input
                    id="probability"
                    type="number"
                    min="0"
                    max="100"
                    {...register('probability')}
                    placeholder="50"
                  />
                  {errors.probability && (
                    <p className="text-sm text-destructive">{errors.probability.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expected_close_date">Expected Close Date</Label>
                <Input
                  id="expected_close_date"
                  type="date"
                  {...register('expected_close_date')}
                />
                {errors.expected_close_date && (
                  <p className="text-sm text-destructive">{errors.expected_close_date.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="metadata">Custom Metadata (JSON)</Label>
                <Textarea
                  id="metadata"
                  {...register('metadata')}
                  placeholder='{"source": "referral", "competitor": "none"}'
                  rows={4}
                />
                {errors.metadata && (
                  <p className="text-sm text-destructive">{errors.metadata.message}</p>
                )}
              </div>

              <div className="flex gap-4">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Updating...' : 'Update Deal'}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href={`/dashboard/crm/deals/${dealId}`}>Cancel</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

