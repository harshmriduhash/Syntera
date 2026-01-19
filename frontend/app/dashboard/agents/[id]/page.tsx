"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAgent, useUpdateAgent } from '@/lib/api/agents'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { use, useEffect } from 'react'
import { agentSchema, transformFormToBackend, transformBackendToForm, type AgentFormValues } from '@/lib/schemas/agent'
import { AGENT_DEFAULTS } from '@/lib/constants/config'
import { AgentEssentialSettings } from '@/components/agents/agent-essential-settings'
import { AgentAIBehavior } from '@/components/agents/agent-ai-behavior'
import { AgentModelSettings } from '@/components/agents/agent-model-settings'
import { AgentVoiceSettings } from '@/components/agents/agent-voice-settings'
import { AgentKnowledgeBaseSection } from '@/components/agents/agent-knowledge-base-section'
import { AgentApiKeySection } from '@/components/agents/agent-api-key-section'
import { AgentWidgetEmbedSection } from '@/components/agents/agent-widget-embed-section'


export default function EditAgentPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const { data: agent, isLoading, error } = useAgent(id)
  const updateAgent = useUpdateAgent()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<AgentFormValues>({
    resolver: zodResolver(agentSchema),
    defaultValues: {
      name: '',
      description: '',
      system_prompt: '',
      personality_tone: AGENT_DEFAULTS.PERSONALITY_TONE,
      communication_style: AGENT_DEFAULTS.COMMUNICATION_STYLE,
      voice: AGENT_DEFAULTS.VOICE,
      model: AGENT_DEFAULTS.MODEL,
      temperature: AGENT_DEFAULTS.TEMPERATURE,
      max_tokens: AGENT_DEFAULTS.MAX_TOKENS,
      enabled: AGENT_DEFAULTS.ENABLED,
    },
  })


  // Update form when agent data loads
  useEffect(() => {
    if (agent) {
      // Transform backend agent data to frontend form format
      const formData = transformBackendToForm(agent)
      // Set defaults for UI-only fields
      form.reset({
        ...formData,
        personality_tone: AGENT_DEFAULTS.PERSONALITY_TONE,
        communication_style: AGENT_DEFAULTS.COMMUNICATION_STYLE,
      })
    }
  }, [agent, form])

  async function onSubmit(values: AgentFormValues) {
    setIsSubmitting(true)
    try {
      // Transform frontend form data to backend format
      const input = transformFormToBackend(values)

      await updateAgent.mutateAsync({ id, data: input })
      router.push('/dashboard/agents')
    } catch (error) {
      // Error handled by mutation
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-6 w-96" />
          </div>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !agent) {
    return (
      <div className="space-y-8">
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="text-destructive">
              {error?.message || 'Failed to load agent. Please try again.'}
            </p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/agents">Back to Agents</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b pb-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/dashboard/agents">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-4xl font-bold tracking-tight">
                {agent.name}
              </h1>
              <p className="text-muted-foreground text-lg mt-1">
                Configure your AI agent settings
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" asChild>
              <Link href="/dashboard/agents">Cancel</Link>
            </Button>
            <Button type="submit" form="agent-form" disabled={isSubmitting} size="lg">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </motion.div>
      </div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Form {...form}>
          <form id="agent-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <AgentEssentialSettings form={form} />
            <AgentAIBehavior form={form} />
            <AgentModelSettings form={form} />
            <AgentVoiceSettings form={form} />
            <AgentApiKeySection agentId={id} apiKey={agent?.public_api_key} />
            <AgentWidgetEmbedSection agentId={id} apiKey={agent?.public_api_key} />
            <AgentKnowledgeBaseSection agentId={id} />
          </form>
        </Form>
      </motion.div>
    </div>
  )
}
