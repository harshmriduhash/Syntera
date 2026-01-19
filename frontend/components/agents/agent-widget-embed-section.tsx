'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Copy, Check, Code2 } from 'lucide-react'
import { toast } from 'sonner'

interface AgentWidgetEmbedSectionProps {
  agentId: string
  apiKey: string | null | undefined
}

const WIDGET_CDN_URL = 'https://pub-487d70fa1de84574af35bd20e7e86e60.r2.dev'

const POSITION_OPTIONS = [
  { value: 'bottom-right', label: 'Bottom Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'top-left', label: 'Top Left' },
] as const

const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const

export function AgentWidgetEmbedSection({ agentId, apiKey }: AgentWidgetEmbedSectionProps) {
  const [position, setPosition] = useState<'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'>('bottom-right')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [copied, setCopied] = useState(false)

  const apiUrl = useMemo(() => {
    if (typeof window !== 'undefined') {
      return window.location.origin
    }
    return process.env.NEXT_PUBLIC_APP_URL || 'https://syntera-tau.vercel.app'
  }, [])

  const embedCode = useMemo(() => {
    if (!apiKey) {
      return '<!-- API key required. Please save the agent first to generate an API key. -->'
    }

    return `<!-- Syntera AI Chat Widget -->
<script src="${WIDGET_CDN_URL}/widget.js"
        data-agent-id="${agentId}"
        data-api-key="${apiKey}"
        data-api-url="${apiUrl}"
        data-position="${position}"
        data-theme="${theme}">
</script>
<link rel="stylesheet" href="${WIDGET_CDN_URL}/widget.css">`
  }, [agentId, apiKey, apiUrl, position, theme])

  const handleCopy = async () => {
    if (!apiKey) {
      toast.error('API key required. Please save the agent first.')
      return
    }

    try {
      await navigator.clipboard.writeText(embedCode)
      setCopied(true)
      toast.success('Embed code copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error('Failed to copy embed code')
    }
  }

  if (!apiKey) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5" />
            Widget Embed Code
          </CardTitle>
          <CardDescription>
            Copy and paste this code into your website to embed the AI chat widget.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>API key required:</strong> Please save the agent configuration first to generate an API key. The embed code will appear here once the API key is available.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code2 className="h-5 w-5" />
          Widget Embed Code
        </CardTitle>
        <CardDescription>
          Copy and paste this code into your website HTML to embed the AI chat widget. The widget will appear as a floating button on your site.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="widget-position">Widget Position</Label>
            <Select value={position} onValueChange={(value) => setPosition(value as typeof position)}>
              <SelectTrigger id="widget-position">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POSITION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="widget-theme">Theme</Label>
            <Select value={theme} onValueChange={(value) => setTheme(value as typeof theme)}>
              <SelectTrigger id="widget-theme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THEME_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="embed-code">Embed Code</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="gap-2"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-green-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Code
                </>
              )}
            </Button>
          </div>
          <Textarea
            id="embed-code"
            value={embedCode}
            readOnly
            className="font-mono text-sm min-h-[120px] resize-none"
            onClick={(e) => {
              ;(e.target as HTMLTextAreaElement).select()
            }}
          />
        </div>

        <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 space-y-2">
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
            How to use:
          </p>
          <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
            <li>Copy the embed code above</li>
            <li>Paste it into your website HTML, preferably just before the closing <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">&lt;/body&gt;</code> tag</li>
            <li>The widget will automatically appear on your website</li>
            <li>Users can click the widget button to start chatting with your AI agent</li>
          </ol>
        </div>

        <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Security Note:</strong> The embed code contains your API key. Only share this code with trusted team members who need to embed the widget on your website.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

