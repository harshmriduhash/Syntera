'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MessageList } from '@/components/chat/message-list'
import { ThreadPanel } from '@/components/chat/thread-panel'
import { LoadingSkeleton } from '@/components/shared/loading-skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { useConversation, useMessages, type Message } from '@/lib/api/chat'
import { useChatSocket } from '@/lib/api/chat'
import { useChatSocketEvents } from '@/hooks/use-chat-socket-events'
import { FileText, ChevronUp, Loader2 } from 'lucide-react'
import { PAGINATION } from '@/lib/constants/api'
import { format } from 'date-fns'

interface TranscriptViewProps {
  conversationId: string
  selectedThreadId: string | null
  onThreadSelect: (threadId: string | null) => void
  token: string | null
}

export function TranscriptView({
  conversationId,
  selectedThreadId,
  onThreadSelect,
  token,
}: TranscriptViewProps) {
  const [messageOffset, setMessageOffset] = useState(0)
  const [accumulatedMessages, setAccumulatedMessages] = useState<Message[]>([])

  // Fetch conversation details
  const { data: conversationData, isLoading: conversationLoading } = useConversation(conversationId)
  const conversation = conversationData?.conversation

  // Fetch messages
  const { data: messagesData, isLoading: messagesLoading, isFetching: messagesFetching } = useMessages(
    conversationId,
    {
      limit: PAGINATION.MESSAGES_PAGE_SIZE,
      offset: messageOffset,
      threadId: selectedThreadId,
    }
  )

  // Socket connection for real-time updates (optional for transcripts)
  const { socket, isConnected } = useChatSocket(token)

  // Set up socket event listeners
  useChatSocketEvents({
    socket,
    conversationId,
    threadId: selectedThreadId,
  })

  // Join conversation room when socket connects
  useEffect(() => {
    if (socket && isConnected && conversationId) {
      socket.emit('conversation:join', conversationId)
      if (selectedThreadId) {
        socket.emit('thread:switch', { conversationId, threadId: selectedThreadId })
      }
    }

    return () => {
      if (socket && isConnected) {
        socket.emit('conversation:leave', conversationId)
      }
    }
  }, [socket, isConnected, conversationId, selectedThreadId])

  // Accumulate messages when new data arrives
  useEffect(() => {
    if (messagesData && typeof messagesData === 'object' && 'messages' in messagesData && Array.isArray(messagesData.messages)) {
      if (messageOffset === 0) {
        // First load or reset - replace all
        setAccumulatedMessages(messagesData.messages as Message[])
      } else {
        // Subsequent loads - prepend older messages
        setAccumulatedMessages((prev) => {
          // Avoid duplicates by checking IDs
          const existingIds = new Set(prev.map((m) => m._id))
          const newMessages = (messagesData.messages as Message[]).filter((m: Message) => !existingIds.has(m._id))
          return [...newMessages, ...prev]
        })
      }
    } else if (messageOffset === 0) {
      // Reset accumulated messages when data is cleared and offset is 0
      setAccumulatedMessages([])
    }
  }, [messagesData, messageOffset])

  // Reset message offset when thread changes
  useEffect(() => {
    setMessageOffset(0)
    setAccumulatedMessages([])
  }, [selectedThreadId, conversationId])

  const messages = accumulatedMessages
  const totalMessages = messagesData && typeof messagesData === 'object' && 'total' in messagesData 
    ? (messagesData.total as number) 
    : undefined
  const hasMore = totalMessages !== undefined && messageOffset + messages.length < totalMessages

  const handleLoadMore = () => {
    setMessageOffset((prev) => prev + PAGINATION.MESSAGES_PAGE_SIZE)
  }

  if (conversationLoading) {
    return (
      <Card className="h-[600px]">
        <CardContent className="h-full flex items-center justify-center">
          <LoadingSkeleton />
        </CardContent>
      </Card>
    )
  }

  if (!conversation) {
    return (
      <Card className="h-[600px]">
        <CardContent className="h-full flex items-center justify-center">
          <EmptyState
            icon={FileText}
            title="Conversation not found"
            description="The conversation you're looking for doesn't exist or has been deleted."
          />
        </CardContent>
      </Card>
    )
  }

  const threads = conversation.threads || []

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[600px]">
      {/* Thread Panel */}
      <div className="lg:col-span-1">
        <ThreadPanel
          conversationId={conversationId}
          threads={threads}
          currentThreadId={selectedThreadId}
          onThreadSelect={onThreadSelect}
          token={token}
        />
      </div>

      {/* Messages Area */}
      <div className="lg:col-span-3 flex flex-col">
        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardHeader className="border-b pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Transcript</CardTitle>
                <CardDescription className="mt-1">
                  {conversation.started_at && (
                    <span>
                      {format(new Date(conversation.started_at), 'PPp')}
                    </span>
                  )}
                  {conversation.ended_at && (
                    <span className="ml-2">
                      • Ended {format(new Date(conversation.ended_at), 'PPp')}
                    </span>
                  )}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{conversation.channel}</Badge>
                <Badge variant={conversation.status === 'ended' ? 'secondary' : 'default'}>
                  {conversation.status}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            {messagesLoading && messageOffset === 0 ? (
              <div className="h-full flex items-center justify-center">
                <LoadingSkeleton />
              </div>
            ) : (
              <div className="h-full flex flex-col">
                {hasMore && (
                  <div className="flex justify-center py-4 border-b">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLoadMore}
                      disabled={messagesFetching}
                      className="gap-2"
                    >
                      {messagesFetching ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading older messages...
                        </>
                      ) : (
                        <>
                          <ChevronUp className="h-4 w-4" />
                          Load older messages
                          {totalMessages !== undefined && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({totalMessages - messages.length} remaining)
                            </span>
                          )}
                        </>
                      )}
                    </Button>
                  </div>
                )}
                <div className="flex-1 overflow-hidden">
                  <MessageList
                    messages={messages}
                    conversationId={conversationId}
                    isLoading={messagesLoading && messageOffset === 0}
                    total={totalMessages}
                    hasMore={hasMore}
                    onLoadMore={handleLoadMore}
                    isLoadingMore={messagesFetching && messageOffset > 0}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
