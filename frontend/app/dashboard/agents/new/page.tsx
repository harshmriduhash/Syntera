"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useCreateAgent } from '@/lib/api/agents'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { agentSchema, transformFormToBackend, type AgentFormValues } from '@/lib/schemas/agent'
import { AGENT_DEFAULTS } from '@/lib/constants/config'
import { AgentEssentialSettings } from '@/components/agents/agent-essential-settings'
import { AgentAIBehavior } from '@/components/agents/agent-ai-behavior'
import { AgentModelSettings } from '@/components/agents/agent-model-settings'
import { AgentVoiceSettings } from '@/components/agents/agent-voice-settings'


export default function NewAgentPage() {
  const router = useRouter()
  const createAgent = useCreateAgent()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<AgentFormValues>({
    resolver: zodResolver(agentSchema),
    defaultValues: {
      name: '',
      description: '',
      system_prompt: '',
      avatar_url: null,
      personality_tone: AGENT_DEFAULTS.PERSONALITY_TONE,
      communication_style: AGENT_DEFAULTS.COMMUNICATION_STYLE,
      voice: AGENT_DEFAULTS.VOICE,
      model: AGENT_DEFAULTS.MODEL,
      temperature: AGENT_DEFAULTS.TEMPERATURE,
      max_tokens: AGENT_DEFAULTS.MAX_TOKENS,
      enabled: AGENT_DEFAULTS.ENABLED,
    },
  })


  async function onSubmit(values: AgentFormValues) {
    setIsSubmitting(true)
    try {
      // Transform frontend form data to backend format
      const input = transformFormToBackend(values)

      await createAgent.mutateAsync(input)
      router.push('/dashboard/agents')
    } catch (error) {
      // Error handled by mutation
    } finally {
      setIsSubmitting(false)
    }
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
              <h1 className="text-4xl font-bold tracking-tight">Create New Agent</h1>
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
              Create Agent
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
            
            <Card>
              <CardHeader>
                <CardTitle>Knowledge Base</CardTitle>
                <CardDescription>
                  You can upload documents to provide context for this agent after creating it. 
                  Documents will help the agent answer questions accurately using your company's information.
                </CardDescription>
              </CardHeader>
            </Card>
          </form>
        </Form>
      </motion.div>
    </div>
  )
}

