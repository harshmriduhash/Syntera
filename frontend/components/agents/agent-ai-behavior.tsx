'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UseFormReturn } from 'react-hook-form'
import type { AgentFormValues } from '@/lib/schemas/agent'

const PERSONALITY_TONES = {
  professional: {
    label: 'Professional',
    description: 'Formal, business-like, and respectful',
    prompt: 'You are a professional assistant. Maintain a formal, business-like tone. Be respectful and courteous at all times.',
  },
  friendly: {
    label: 'Friendly',
    description: 'Warm, approachable, and personable',
    prompt: 'You are a friendly assistant. Use a warm, approachable tone. Be personable and make customers feel welcome.',
  },
  casual: {
    label: 'Casual',
    description: 'Relaxed, conversational, and informal',
    prompt: 'You are a casual assistant. Use a relaxed, conversational tone. Be informal but still helpful and respectful.',
  },
  formal: {
    label: 'Formal',
    description: 'Very formal, traditional, and structured',
    prompt: 'You are a formal assistant. Use a very formal, traditional tone. Maintain structure and professionalism in all interactions.',
  },
  enthusiastic: {
    label: 'Enthusiastic',
    description: 'Energetic, positive, and engaging',
    prompt: 'You are an enthusiastic assistant. Use an energetic, positive tone. Be engaging and show excitement when appropriate.',
  },
}

const SYSTEM_PROMPT_TEMPLATES = {
  sales: `You are {name}, a professional sales assistant for {company}. Your role is to:
- Answer product questions accurately and enthusiastically
- Qualify leads based on budget, timeline, and needs
- Schedule demos when appropriate
- Overcome objections with facts and benefits
- Be friendly but professional
- Always ask for the sale when appropriate`,
  support: `You are {name}, a customer support specialist for {company}. Your role is to:
- Help customers resolve issues quickly and efficiently
- Provide clear, step-by-step instructions
- Escalate complex issues when needed
- Show empathy and understanding
- Follow up to ensure satisfaction`,
  general: `You are {name}, an AI assistant for {company}. Your role is to:
- Answer questions accurately and helpfully
- Provide information about products and services
- Assist with common tasks and inquiries
- Be friendly, professional, and efficient
- Escalate to human agents when necessary`,
}

interface AgentAIBehaviorProps {
  form: UseFormReturn<AgentFormValues>
}

export function AgentAIBehavior({ form }: AgentAIBehaviorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [showHelpers, setShowHelpers] = useState(false)

  const generateSystemPrompt = (template: string, name: string, tone: string, style: string) => {
    const tonePrompt = PERSONALITY_TONES[tone as keyof typeof PERSONALITY_TONES]?.prompt || ''
    const communicationStyle = style === 'concise' 
      ? 'Keep responses concise and to the point.'
      : style === 'detailed'
      ? 'Provide detailed, thorough responses.'
      : 'Provide balanced responses with appropriate detail.'
    
    return `${tonePrompt}\n\n${communicationStyle}\n\n${template.replace('{name}', name).replace('{company}', 'your company')}`
  }

  const handleTemplateSelect = (template: string) => {
    setSelectedTemplate(template)
    const name = form.getValues('name') || 'Assistant'
    const tone = form.getValues('personality_tone') || 'professional'
    const style = form.getValues('communication_style') || 'balanced'
    const prompt = generateSystemPrompt(
      SYSTEM_PROMPT_TEMPLATES[template as keyof typeof SYSTEM_PROMPT_TEMPLATES],
      name,
      tone,
      style
    )
    form.setValue('system_prompt', prompt)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Behavior</CardTitle>
        <CardDescription>
          Define how your agent responds and interacts with users
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <FormField
          control={form.control}
          name="system_prompt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>System Prompt *</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="You are Sarah, a professional sales assistant..."
                  className="min-h-[200px] font-mono text-sm"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Collapsible open={showHelpers} onOpenChange={setShowHelpers}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-between"
            >
              <span className="text-sm text-muted-foreground">
                Quick Setup Helpers (Optional)
              </span>
              {showHelpers ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Personality Tone (helps generate prompt)
              </Label>
              <div className="grid grid-cols-5 gap-2">
                {Object.entries(PERSONALITY_TONES).map(([key, value]) => (
                  <Button
                    key={key}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-auto flex-col items-start p-2 text-xs",
                      form.watch('personality_tone') === key
                        ? "border-primary bg-primary/10"
                        : ""
                    )}
                    onClick={() => form.setValue('personality_tone', key as any)}
                  >
                    <span className="font-medium">{value.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Communication Style (helps generate prompt)
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-auto flex-col items-start p-2 text-xs",
                    form.watch('communication_style') === 'concise'
                      ? "border-primary bg-primary/10"
                      : ""
                  )}
                  onClick={() => form.setValue('communication_style', 'concise')}
                >
                  <span className="font-medium">Concise</span>
                  <span className="text-[10px] text-muted-foreground">Short, to-the-point</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-auto flex-col items-start p-2 text-xs",
                    form.watch('communication_style') === 'balanced'
                      ? "border-primary bg-primary/10"
                      : ""
                  )}
                  onClick={() => form.setValue('communication_style', 'balanced')}
                >
                  <span className="font-medium">Balanced</span>
                  <span className="text-[10px] text-muted-foreground">Appropriate detail</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-auto flex-col items-start p-2 text-xs",
                    form.watch('communication_style') === 'detailed'
                      ? "border-primary bg-primary/10"
                      : ""
                  )}
                  onClick={() => form.setValue('communication_style', 'detailed')}
                >
                  <span className="font-medium">Detailed</span>
                  <span className="text-[10px] text-muted-foreground">Comprehensive</span>
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Quick Templates (generates prompt)
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(SYSTEM_PROMPT_TEMPLATES).map(([key]) => (
                  <Button
                    key={key}
                    type="button"
                    variant="outline"
                    className={cn(
                      "h-auto flex-col items-start p-3 transition-all",
                      selectedTemplate === key
                        ? "border-primary bg-primary/20 dark:bg-primary/30 text-primary"
                        : "hover:bg-accent"
                    )}
                    onClick={() => handleTemplateSelect(key)}
                  >
                    <span className="font-medium capitalize">{key}</span>
                    <span className={cn(
                      "text-xs mt-1",
                      selectedTemplate === key ? "text-primary/80" : "text-muted-foreground"
                    )}>
                      {key === 'sales' && 'Sales & Lead Qualification'}
                      {key === 'support' && 'Customer Support'}
                      {key === 'general' && 'General Assistant'}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )
}



