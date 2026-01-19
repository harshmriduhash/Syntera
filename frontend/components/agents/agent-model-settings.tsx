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
import { Slider } from '@/components/ui/slider'
import type { UseFormReturn } from 'react-hook-form'
import type { AgentFormValues } from '@/lib/schemas/agent'

interface AgentModelSettingsProps {
  form: UseFormReturn<AgentFormValues>
}

export function AgentModelSettings({ form }: AgentModelSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Model Configuration</CardTitle>
        <CardDescription>
          Configure the AI model parameters for response generation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <FormField
          control={form.control}
          name="model"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Model</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="gpt-4-turbo">GPT-4 Turbo (Recommended)</SelectItem>
                  <SelectItem value="gpt-4">GPT-4</SelectItem>
                  <SelectItem value="gpt-4o-mini">GPT-4o Mini (Faster, Lower Cost)</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="temperature"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Temperature: {field.value.toFixed(1)}</FormLabel>
              <FormControl>
                <div className="space-y-2">
                  <Slider
                    value={[field.value]}
                    onValueChange={(value) => field.onChange(value[0])}
                    min={0}
                    max={2}
                    step={0.1}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground px-1">
                    <span>Precise (0.0)</span>
                    <span>Balanced (1.0)</span>
                    <span>Creative (2.0)</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Controls randomness and creativity of responses
                  </p>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="max_tokens"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Max Tokens: {field.value}</FormLabel>
              <FormControl>
                <div className="space-y-2">
                  <Slider
                    value={[field.value]}
                    onValueChange={(value) => field.onChange(value[0])}
                    min={100}
                    max={4000}
                    step={100}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground px-1">
                    <span>Short (100)</span>
                    <span>Medium (2000)</span>
                    <span>Long (4000)</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Maximum response length. Note: Only applies to text chat, not voice calls.
                  </p>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  )
}



