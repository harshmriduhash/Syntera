'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { UseFormReturn } from 'react-hook-form'
import type { AgentFormValues } from '@/lib/schemas/agent'
import { VOICE_OPTIONS } from '@/lib/constants/config'

interface AgentVoiceSettingsProps {
  form: UseFormReturn<AgentFormValues>
}

export function AgentVoiceSettings({ form }: AgentVoiceSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Voice Settings</CardTitle>
        <CardDescription>
          Configure the TTS voice for voice calls using LiveKit Inference providers (Cartesia, ElevenLabs, Rime, Inworld). Text chat is not affected.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField
          control={form.control}
          name="voice"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Voice Selection</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a voice" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {VOICE_OPTIONS.map(voice => (
                    <SelectItem key={voice.value} value={voice.value}>
                      {voice.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {field.value && (
                <p className="text-xs text-muted-foreground mt-1">
                  Current voice: <span className="font-medium text-foreground">{VOICE_OPTIONS.find(v => v.value === field.value)?.label || field.value}</span>
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Only applies to voice calls. Text chat uses the system prompt only.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  )
}

