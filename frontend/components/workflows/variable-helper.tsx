"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { HelpCircle, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Variable {
  name: string
  description: string
  example: string
}

const VARIABLES_BY_CONTEXT: Record<string, Variable[]> = {
  default: [
    { name: 'contact.name', description: 'Contact full name', example: 'John Doe' },
    { name: 'contact.email', description: 'Contact email address', example: 'john@example.com' },
    { name: 'contact.phone', description: 'Contact phone number', example: '+1234567890' },
    { name: 'contact.company_name', description: 'Contact company name', example: 'Acme Corp' },
    { name: 'conversation.id', description: 'Conversation ID', example: 'conv_123' },
    { name: 'conversation.channel', description: 'Conversation channel', example: 'chat' },
    { name: 'agent.id', description: 'Agent ID', example: 'agent_123' },
    { name: 'agent.name', description: 'Agent name', example: 'Support Bot' },
    { name: 'company.id', description: 'Company ID', example: 'company_123' },
  ],
  purchase_intent: [
    { name: 'intent', description: 'Detected intent', example: 'purchase' },
    { name: 'confidence', description: 'Intent confidence score', example: '0.95' },
    { name: 'message', description: 'User message', example: 'I want to buy...' },
  ],
  deal: [
    { name: 'deal.id', description: 'Deal ID', example: 'deal_123' },
    { name: 'deal.title', description: 'Deal title', example: 'Enterprise Plan' },
    { name: 'deal.value', description: 'Deal value', example: '5000' },
    { name: 'deal.stage', description: 'Deal stage', example: 'qualified' },
    { name: 'deal.probability', description: 'Deal probability', example: '75' },
  ],
  message: [
    { name: 'message', description: 'Message content', example: 'Hello, I need help' },
    { name: 'message.id', description: 'Message ID', example: 'msg_123' },
  ],
  webhook: [
    { name: 'webhook.payload', description: 'Webhook payload', example: '{...}' },
    { name: 'webhook.headers', description: 'Webhook headers', example: '{...}' },
  ],
}

interface VariableHelperProps {
  context?: string
  onInsert?: (variable: string) => void
  className?: string
}

export function VariableHelper({ context = 'default', onInsert, className }: VariableHelperProps) {
  const [copied, setCopied] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const variables = [
    ...VARIABLES_BY_CONTEXT.default,
    ...(VARIABLES_BY_CONTEXT[context] || []),
  ]

  const handleCopy = (variable: string) => {
    const variableText = `{{${variable}}}`
    navigator.clipboard.writeText(variableText)
    setCopied(variable)
    setTimeout(() => setCopied(null), 2000)

    if (onInsert) {
      onInsert(variableText)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("h-8 gap-1", className)}
        >
          <HelpCircle className="h-3.5 w-3.5" />
          Variables
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b">
          <h4 className="text-sm font-semibold">Available Variables</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Click to copy and insert into your field
          </p>
        </div>
        <div className="max-h-96 overflow-y-auto p-2">
          <div className="space-y-1">
            {variables.map((variable) => {
              const variableText = `{{${variable.name}}}`
              const isCopied = copied === variable.name
              return (
                <button
                  key={variable.name}
                  type="button"
                  onClick={() => handleCopy(variable.name)}
                  className="w-full text-left p-2 rounded-md hover:bg-muted transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-primary">
                          {variableText}
                        </code>
                        {isCopied ? (
                          <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
                        ) : (
                          <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {variable.description}
                      </p>
                      {variable.example && (
                        <p className="text-xs text-muted-foreground/70 mt-0.5 italic">
                          Example: {variable.example}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}










