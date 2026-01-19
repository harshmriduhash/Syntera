'use client'

import { useState, useEffect } from 'react'
import { useConversations, type Conversation } from '@/lib/api/chat'
import { useAgents } from '@/lib/api/agents'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { FileText, MessageSquare, Mic, Video, Search, ChevronDown } from 'lucide-react'
// Tree-shakeable imports from date-fns (smaller bundle)
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow'
import dynamic from 'next/dynamic'
import { LoadingSkeleton } from '@/components/shared/loading-skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { PAGINATION } from '@/lib/constants/api'
import { cn } from '@/lib/utils'

// Lazy load TranscriptView component (contains heavy dependencies like socket.io, date-fns format)
const TranscriptView = dynamic(
  () => import('./transcript-view').then((mod) => mod.TranscriptView),
  {
    ssr: false,
    loading: () => (
      <Card className="h-[600px] flex items-center justify-center">
        <LoadingSkeleton />
      </Card>
    ),
  }
)

export default function TranscriptsPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [conversationOffset, setConversationOffset] = useState<number>(0)
  const [accumulatedConversations, setAccumulatedConversations] = useState<Conversation[]>([])
  const [token, setToken] = useState<string | null>(null)
  
  const { data: agents } = useAgents()
  const { data: conversationsData, isLoading: conversationsLoading, isFetching: conversationsFetching } = useConversations({ 
    status: 'ended', // Only show ended conversations (completed transcripts)
    limit: PAGINATION.CONVERSATIONS_PAGE_SIZE,
    offset: conversationOffset,
  }) as { data?: { conversations: Conversation[]; total: number } | undefined; isLoading: boolean; isFetching: boolean }

  // Get auth token
  useEffect(() => {
    async function getToken() {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        setToken(session.access_token)
      }
    }
    getToken()
  }, [])

  // Accumulate conversations when new data arrives
  useEffect(() => {
    if (conversationsData && 'conversations' in conversationsData && conversationsData.conversations) {
      if (conversationOffset === 0) {
        // First load or reset - replace all
        setAccumulatedConversations(conversationsData.conversations)
      } else {
        // Subsequent loads - append new conversations
        setAccumulatedConversations(prev => {
          // Avoid duplicates by checking IDs
          const existingIds = new Set(prev.map(c => c._id))
          const newConversations = conversationsData.conversations.filter(c => !existingIds.has(c._id))
          return [...prev, ...newConversations]
        })
      }
    } else if (conversationOffset === 0) {
      // Reset accumulated conversations when data is cleared and offset is 0
      setAccumulatedConversations([])
    }
  }, [conversationsData, conversationOffset])

  // Properly typed response - API returns { conversations: Conversation[], total: number }
  const conversations: Conversation[] = accumulatedConversations
  const totalConversations = conversationsData?.total

  // Filter conversations by search query
  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true
    const agent = agents?.find(a => a.id === conv.agent_id)
    const searchLower = searchQuery.toLowerCase()
    return (
      agent?.name.toLowerCase().includes(searchLower) ||
      conv.agent_id.toLowerCase().includes(searchLower) ||
      conv._id.toLowerCase().includes(searchLower) ||
      conv.tags?.some(tag => tag.toLowerCase().includes(searchLower))
    )
  })

  if (conversationsLoading) {
    return <LoadingSkeleton />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transcripts</h1>
          <p className="text-muted-foreground">
            View and organize conversation transcripts
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar - Conversation List */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Conversations</CardTitle>
              <CardDescription>
                {totalConversations !== undefined && `${conversations.length} of ${totalConversations} conversations`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9"
                />
              </div>
              
              {filteredConversations.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No conversations found"
                  description={searchQuery ? "Try a different search term" : "No ended conversations yet"}
                />
              ) : (
                <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
                  {filteredConversations.map((conversation) => {
                    const agent = agents?.find(a => a.id === conversation.agent_id)
                    const isSelected = selectedConversationId === conversation._id
                    return (
                      <Button
                        key={conversation._id}
                        variant={isSelected ? 'default' : 'ghost'}
                        className={cn(
                          'w-full justify-start h-auto py-3 px-3',
                          isSelected && 'bg-primary text-primary-foreground shadow-sm'
                        )}
                        onClick={() => setSelectedConversationId(conversation._id)}
                      >
                        <div className="flex items-center gap-2 w-full">
                          {conversation.channel === 'voice' ? (
                            <Mic className="h-4 w-4 shrink-0" />
                          ) : conversation.channel === 'video' ? (
                            <Video className="h-4 w-4 shrink-0" />
                          ) : (
                            <MessageSquare className="h-4 w-4 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0 text-left">
                            <p className="font-medium text-sm truncate">
                              {agent?.name || 'Agent Conversation'}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-xs opacity-70">
                                {formatDistanceToNow(new Date(conversation.started_at), { addSuffix: true })}
                              </p>
                              <Badge variant="outline" className="text-xs">
                                {conversation.channel}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </Button>
                    )
                  })}
                  
                  {totalConversations !== undefined && conversationOffset + conversations.length < totalConversations && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => setConversationOffset(prev => prev + PAGINATION.CONVERSATIONS_PAGE_SIZE)}
                      disabled={conversationsFetching}
                    >
                      {conversationsFetching ? (
                        <>
                          <ChevronDown className="h-4 w-4 mr-2 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4 mr-2" />
                          Load more ({totalConversations - (conversationOffset + conversations.length)} remaining)
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Area - Transcript View */}
        <div className="lg:col-span-2">
          {selectedConversationId ? (
            <TranscriptView 
              conversationId={selectedConversationId} 
              selectedThreadId={selectedThreadId}
              onThreadSelect={setSelectedThreadId}
              token={token}
            />
          ) : (
            <Card className="h-[600px] flex items-center justify-center">
              <div className="text-center space-y-4">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <h3 className="text-lg font-semibold">No conversation selected</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Select a conversation to view its transcript
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

