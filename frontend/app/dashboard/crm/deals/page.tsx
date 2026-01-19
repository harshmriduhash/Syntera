"use client"

import { useState } from 'react'
import { useDeals } from '@/lib/api/crm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LoadingSkeleton } from '@/components/shared/loading-skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { Briefcase, Plus, DollarSign, User, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { LazyMotionDiv } from '@/components/shared/lazy-motion'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination'

const STAGES = [
  { id: 'lead', label: 'Lead', color: 'bg-gray-500' },
  { id: 'qualified', label: 'Qualified', color: 'bg-blue-500' },
  { id: 'proposal', label: 'Proposal', color: 'bg-yellow-500' },
  { id: 'negotiation', label: 'Negotiation', color: 'bg-orange-500' },
  { id: 'closed-won', label: 'Won', color: 'bg-green-500' },
  { id: 'closed-lost', label: 'Lost', color: 'bg-red-500' },
] as const

const DEALS_PER_PAGE = 5

export default function DealsPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const offset = (currentPage - 1) * DEALS_PER_PAGE
  const { data, isLoading, error } = useDeals({ limit: DEALS_PER_PAGE, offset })

  const deals = data?.deals || []
  const totalDeals = data?.total || 0
  const totalPages = Math.ceil(totalDeals / DEALS_PER_PAGE)

  const getDealsByStage = (stage: string) => {
    return deals.filter((deal) => deal.stage === stage)
  }

  const getStageInfo = (stage: string) => {
    return STAGES.find((s) => s.id === stage) || STAGES[0]
  }

  if (isLoading) {
    return <LoadingSkeleton />
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load deals. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <LazyMotionDiv
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/crm">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight">Deals Pipeline</h1>
            <p className="text-muted-foreground text-lg">
              Track and manage your sales opportunities
            </p>
          </div>
        </div>
        <LazyMotionDiv
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Button asChild>
            <Link href="/dashboard/crm/deals/new">
              <Plus className="mr-2 h-4 w-4" />
              New Deal
            </Link>
          </Button>
        </LazyMotionDiv>
      </LazyMotionDiv>

      {/* Pipeline Kanban */}
      {deals.length === 0 ? (
        <LazyMotionDiv
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <EmptyState
            icon={Briefcase}
            title="No deals found"
            description="Get started by creating your first deal"
            action={
              <Button asChild>
                <Link href="/dashboard/crm/deals/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Deal
                </Link>
              </Button>
            }
          />
        </LazyMotionDiv>
      ) : (
        <div className="grid gap-4 overflow-x-auto pb-4 md:grid-cols-3 lg:grid-cols-6">
          {STAGES.map((stage, stageIndex) => {
            const stageDeals = getDealsByStage(stage.id)
            const stageValue = stageDeals.reduce((sum, deal) => sum + (deal.value || 0), 0)

            return (
              <LazyMotionDiv
                key={stage.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 + stageIndex * 0.05 }}
                className="min-w-[280px]"
              >
                <Card className="h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">{stage.label}</CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        {stageDeals.length}
                      </Badge>
                    </div>
                    {stageValue > 0 && (
                      <CardDescription className="text-xs">
                        ${stageValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {stageDeals.map((deal, dealIndex) => (
                      <LazyMotionDiv
                        key={deal.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2, delay: dealIndex * 0.05 }}
                      >
                        <Card
                          className={cn(
                            "hover:shadow-md transition-shadow cursor-pointer border-l-4",
                            `border-l-${getStageInfo(deal.stage).color.replace('bg-', '')}`
                          )}
                        >
                          <Link href={`/dashboard/crm/deals/${deal.id}`}>
                            <CardContent className="p-4 space-y-2">
                              <div className="flex items-start justify-between">
                                <h4 className="font-medium text-sm line-clamp-2">{deal.title}</h4>
                              </div>
                              {deal.value && (
                                <div className="flex items-center gap-1 text-sm font-semibold">
                                  <DollarSign className="h-3 w-3" />
                                  {deal.value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </div>
                              )}
                              {deal.contacts && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <User className="h-3 w-3" />
                                  {deal.contacts.first_name || deal.contacts.last_name
                                    ? `${deal.contacts.first_name || ''} ${deal.contacts.last_name || ''}`.trim()
                                    : deal.contacts.email || 'Unknown'}
                                </div>
                              )}
                              {deal.probability > 0 && (
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className={cn("h-full", getStageInfo(deal.stage).color)}
                                      style={{ width: `${deal.probability}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-muted-foreground">{deal.probability}%</span>
                                </div>
                              )}
                              {deal.expected_close_date && (
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(deal.expected_close_date), 'MMM d, yyyy')}
                                </p>
                              )}
                            </CardContent>
                          </Link>
                        </Card>
                      </LazyMotionDiv>
                    ))}
                    {stageDeals.length === 0 && (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        No deals in this stage
                      </div>
                    )}
                  </CardContent>
                </Card>
              </LazyMotionDiv>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <LazyMotionDiv
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex items-center justify-between"
        >
          <div className="text-sm text-muted-foreground">
            Showing {offset + 1} to {Math.min(offset + DEALS_PER_PAGE, totalDeals)} of {totalDeals} deals
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    if (currentPage > 1) setCurrentPage(currentPage - 1)
                  }}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }
                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        setCurrentPage(pageNum)
                      }}
                      isActive={currentPage === pageNum}
                      className="cursor-pointer"
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                )
              })}
              {totalPages > 5 && currentPage < totalPages - 2 && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    if (currentPage < totalPages) setCurrentPage(currentPage + 1)
                  }}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </LazyMotionDiv>
      )}
    </div>
  )
}

