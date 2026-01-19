"use client"

import { useDeal } from '@/lib/api/crm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LoadingSkeleton } from '@/components/shared/loading-skeleton'
import { ArrowLeft, DollarSign, Calendar, User, Edit } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

const STAGE_COLORS: Record<string, string> = {
  lead: 'bg-gray-500',
  qualified: 'bg-blue-500',
  proposal: 'bg-yellow-500',
  negotiation: 'bg-orange-500',
  'closed-won': 'bg-green-500',
  'closed-lost': 'bg-red-500',
}

export default function DealDetailPage() {
  const params = useParams()
  const dealId = params.id as string
  const { data, isLoading, error } = useDeal(dealId)

  const deal = data?.deal

  if (isLoading) {
    return <LoadingSkeleton />
  }

  if (error || !deal) {
    return (
      <div className="space-y-6">
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load deal. Please try again.</p>
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

  const getContactName = () => {
    if (!deal.contacts) return 'No contact assigned'
    const contact = deal.contacts
    if (contact.first_name || contact.last_name) {
      return `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
    }
    return contact.email || contact.phone || 'Unnamed Contact'
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/crm/deals">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-bold tracking-tight">{deal.title}</h1>
              <Badge
                className={cn(
                  'text-white',
                  STAGE_COLORS[deal.stage] || 'bg-gray-500'
                )}
              >
                {deal.stage.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </Badge>
            </div>
            <p className="text-muted-foreground text-lg">Deal Details</p>
          </div>
        </div>
        <Button asChild>
          <Link href={`/dashboard/crm/deals/${deal.id}/edit`}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Deal
          </Link>
        </Button>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Deal Information */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Deal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {deal.value && (
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Value</p>
                    <p className="text-2xl font-bold">
                      ${deal.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              )}
              {deal.probability > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Win Probability</span>
                    <span className="font-medium">{deal.probability}%</span>
                  </div>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all",
                        STAGE_COLORS[deal.stage] || 'bg-gray-500'
                      )}
                      style={{ width: `${deal.probability}%` }}
                    />
                  </div>
                </div>
              )}
              {deal.expected_close_date && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Expected Close Date</p>
                    <p className="text-base">
                      {format(new Date(deal.expected_close_date), 'PP')}
                    </p>
                  </div>
                </div>
              )}
              {deal.contacts && (
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Contact</p>
                    <Link
                      href={`/dashboard/crm/contacts/${deal.contacts.id}/edit`}
                      className="text-base hover:underline"
                    >
                      {getContactName()}
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Metadata */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="text-base">
                    {format(new Date(deal.created_at), 'PPp')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Last Updated</p>
                  <p className="text-base">
                    {format(new Date(deal.updated_at), 'PPp')}
                  </p>
                </div>
              </div>
              {deal.metadata && Object.keys(deal.metadata).length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Custom Fields</p>
                  <div className="space-y-1">
                    {Object.entries(deal.metadata).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{key}:</span>
                        <span>{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

