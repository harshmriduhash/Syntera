'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileUpload } from '@/components/knowledge-base/file-upload'
import { useDocuments, useDeleteDocument, type KnowledgeBaseDocument } from '@/lib/api/knowledge-base'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Trash2, CheckCircle2, XCircle, Clock, Loader2, FileText } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { getFileIcon, getFileIconColor } from '@/lib/utils/file-icons'
import { cn } from '@/lib/utils'
import dynamic from 'next/dynamic'

// Lazy load file viewer (heavy component with PDF support)
const FileViewer = dynamic(() => import('@/components/knowledge-base/file-viewer').then((mod) => ({ default: mod.FileViewer })), {
  ssr: false,
  loading: () => <div className="h-[600px] flex items-center justify-center">Loading file viewer...</div>,
})

const STATUS_COLORS = {
  pending: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  processing: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  completed: 'bg-green-500/10 text-green-600 dark:text-green-400',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-400',
}

const STATUS_ICONS = {
  pending: Clock,
  processing: Loader2,
  completed: CheckCircle2,
  failed: XCircle,
}

interface AgentKnowledgeBaseSectionProps {
  agentId: string
}

export function AgentKnowledgeBaseSection({ agentId }: AgentKnowledgeBaseSectionProps) {
  const { data: documents, isLoading, refetch } = useDocuments(agentId)
  const deleteMutation = useDeleteDocument()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<KnowledgeBaseDocument | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<KnowledgeBaseDocument | null>(null)

  const handleDelete = async () => {
    if (!documentToDelete) return

    try {
      await deleteMutation.mutateAsync(documentToDelete.id)
      setDeleteDialogOpen(false)
      setDocumentToDelete(null)
      refetch()
    } catch (error) {
      // Error handled by mutation
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Knowledge Base</CardTitle>
          <CardDescription>
            Upload documents to provide context for this agent. The agent will use these documents to answer questions accurately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <FileUpload agentId={agentId} onUploadComplete={() => refetch()} />

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : !documents || documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">No documents uploaded yet</p>
              <p className="text-xs mt-1">Upload documents to enhance the agent's knowledge</p>
            </div>
          ) : (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Uploaded Documents ({documents.length})</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {documents.map((document) => {
                  const StatusIcon = STATUS_ICONS[document.status]
                  const FileIcon = getFileIcon(document.name)
                  const iconColor = getFileIconColor(document.name)

                  return (
                    <div
                      key={document.id}
                      onClick={() => {
                        setSelectedDocument(document)
                        setViewerOpen(true)
                      }}
                      className="group relative flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                    >
                      <div className={cn(
                        "rounded-lg bg-primary/10 p-2 shrink-0",
                        iconColor
                      )}>
                        <FileIcon className={cn("h-5 w-5", iconColor)} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate" title={document.name}>
                          {document.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            variant="outline"
                            className={cn(STATUS_COLORS[document.status], "text-xs")}
                          >
                            <StatusIcon
                              className={cn(
                                "h-3 w-3 mr-1",
                                document.status === 'processing' && 'animate-spin'
                              )}
                            />
                            {document.status}
                          </Badge>
                          {document.status === 'completed' && (
                            <span className="text-xs text-muted-foreground">
                              {document.chunk_count} chunks
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(document.created_at), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setDocumentToDelete(document)
                          setDeleteDialogOpen(true)
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{documentToDelete?.name}&quot;? This action cannot be undone
              and will also remove all associated chunks and vectors.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleDelete()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FileViewer
        document={selectedDocument}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />
    </>
  )
}

