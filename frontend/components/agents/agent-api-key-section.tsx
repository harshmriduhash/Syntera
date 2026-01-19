'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Eye, EyeOff, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

interface AgentApiKeySectionProps {
  agentId: string
  apiKey: string | null | undefined
}

export function AgentApiKeySection({ agentId, apiKey }: AgentApiKeySectionProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!apiKey) {
      toast.error('API key not available')
      return
    }

    try {
      await navigator.clipboard.writeText(apiKey)
      setCopied(true)
      toast.success('API key copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error('Failed to copy API key')
    }
  }

  const displayKey = apiKey || 'Not generated yet'

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Key</CardTitle>
        <CardDescription>
          Use this API key to authenticate widget requests. Keep it secure and never share it publicly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              type={isVisible ? 'text' : 'password'}
              value={displayKey}
              readOnly
              className="font-mono text-sm pr-20"
              placeholder="API key will appear here"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsVisible(!isVisible)}
                disabled={!apiKey}
              >
                {isVisible ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleCopy}
                disabled={!apiKey}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {!apiKey && (
          <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              API key will be generated automatically when you save changes to this agent.
            </p>
          </div>
        )}

        {apiKey && (
          <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Security Note:</strong> This API key provides access to your agent. Keep it private and only use it in your widget implementation.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

