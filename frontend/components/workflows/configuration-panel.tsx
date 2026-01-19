"use client"

import { useWorkflowStore } from '@/lib/store/workflow-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAgents } from '@/lib/api/agents'
import { VariableHelper } from './variable-helper'
import { KeyValueEditor } from '@/components/ui/key-value-editor'

// Special value to represent "any" selection (Radix UI Select doesn't allow empty strings)
const ANY_VALUE = '__any__'

// Helper to convert between display value and stored value
const toSelectValue = (value: string | undefined): string => value || ANY_VALUE
const fromSelectValue = (value: string): string | undefined => value === ANY_VALUE ? undefined : value

interface ConfigurationPanelProps {
  nodeId: string
  onClose: () => void
}

export function ConfigurationPanel({ nodeId, onClose }: ConfigurationPanelProps) {
  const { nodes, updateNode } = useWorkflowStore()
  const node = nodes.find((n) => n.id === nodeId)
  const [config, setConfig] = useState<Record<string, unknown>>({})

  useEffect(() => {
    if (node) {
      setConfig((node.data.config as Record<string, unknown>) || {})
    }
  }, [node])

  if (!node) {
    return null
  }

  const handleSave = () => {
    const updatedNode = {
      ...node,
      data: {
        ...node.data,
        config,
        nodeType: (node.data as any).nodeType || node.type,
        label: (node.data as any).label || node.id,
      },
    }
    updateNode(nodeId, updatedNode)
    onClose()
  }

  const renderConfigForm = () => {
    switch (node.type) {
      case 'trigger':
        return <TriggerConfigForm triggerType={(node.data as any).nodeType} config={config} onChange={setConfig} />
      case 'condition':
        return <ConditionConfigForm config={config} onChange={setConfig} />
      case 'action':
        return <ActionConfigForm nodeType={(node.data as any).nodeType} config={config} onChange={setConfig} />
      default:
        return <div className="text-sm text-muted-foreground">No configuration available</div>
    }
  }

  return (
    <div className="w-72 border-l bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 overflow-y-auto shadow-lg">
      <Card className="border-0 rounded-none h-full flex flex-col">
        <CardHeader className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Configure Node</CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {renderConfigForm()}
        </CardContent>
        <div className="border-t p-3">
          <Button onClick={handleSave} className="w-full" size="sm">
            Save
          </Button>
        </div>
      </Card>
    </div>
  )
}

function TriggerConfigForm({
  triggerType,
  config,
  onChange,
}: {
  triggerType: string
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
}) {
  const { data: agents } = useAgents()
  
  type Agent = { id: string; name: string }

  switch (triggerType) {
    case 'purchase_intent':
      return (
        <div className="space-y-4">
          <div>
            <Label>Intent Type (Optional)</Label>
            <Input
              value={(config.intent_type as string) || ''}
              onChange={(e) => onChange({ ...config, intent_type: e.target.value || undefined })}
              placeholder="purchase, inquiry, support"
            />
            <p className="text-xs text-muted-foreground mt-1">Leave empty to match any intent</p>
          </div>
          <div>
            <Label>Confidence Threshold</Label>
            <Input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={(config.confidence_threshold as number) || 0.8}
              onChange={(e) =>
                onChange({ ...config, confidence_threshold: parseFloat(e.target.value) })
              }
            />
            <p className="text-xs text-muted-foreground mt-1">Minimum confidence (0-1)</p>
          </div>
          <div>
            <Label>Agent ID (Optional)</Label>
            <select
              className="w-full p-2 border rounded"
              value={(config.agent_id as string) || ''}
              onChange={(e) => onChange({ ...config, agent_id: e.target.value || undefined })}
            >
              <option value="">Any Agent</option>
              {agents?.map((agent: Agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )
    case 'conversation_started':
      return (
        <div className="space-y-4">
          <div>
            <Label>Agent ID (Optional)</Label>
            <Select
              value={toSelectValue(config.agent_id as string)}
              onValueChange={(value) => onChange({ ...config, agent_id: fromSelectValue(value) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Any Agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_VALUE}>Any Agent</SelectItem>
                {agents?.map((agent: Agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Channel (Optional)</Label>
            <Select
              value={toSelectValue(config.channel as string)}
              onValueChange={(value) => onChange({ ...config, channel: fromSelectValue(value) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Any Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_VALUE}>Any Channel</SelectItem>
                <SelectItem value="chat">Chat</SelectItem>
                <SelectItem value="voice">Voice</SelectItem>
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )
    case 'contact_created':
      return (
        <div className="space-y-4">
          <div>
            <Label>Source (Optional)</Label>
            <Select
              value={toSelectValue(config.source as string)}
              onValueChange={(value) => onChange({ ...config, source: fromSelectValue(value) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Any Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_VALUE}>Any Source</SelectItem>
                <SelectItem value="widget">Widget</SelectItem>
                <SelectItem value="voice">Voice</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="api">API</SelectItem>
                <SelectItem value="import">Import</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )
    case 'conversation_ended':
      return (
        <div className="space-y-4">
          <div>
            <Label>Agent ID (Optional)</Label>
            <Select
              value={toSelectValue(config.agent_id as string)}
              onValueChange={(value) => onChange({ ...config, agent_id: fromSelectValue(value) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Any Agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_VALUE}>Any Agent</SelectItem>
                {agents?.map((agent: Agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Channel (Optional)</Label>
            <Select
              value={toSelectValue(config.channel as string)}
              onValueChange={(value) => onChange({ ...config, channel: fromSelectValue(value) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Any Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_VALUE}>Any Channel</SelectItem>
                <SelectItem value="chat">Chat</SelectItem>
                <SelectItem value="voice">Voice</SelectItem>
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Minimum Duration (minutes, Optional)</Label>
            <Input
              type="number"
              min="0"
              value={(config.duration_min as number) || ''}
              onChange={(e) => onChange({ ...config, duration_min: e.target.value ? parseInt(e.target.value) : undefined })}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground mt-1">Only trigger if conversation lasted at least this long</p>
          </div>
        </div>
      )
    case 'contact_updated':
      return (
        <div className="space-y-4">
          <div>
            <Label>Source (Optional)</Label>
            <Select
              value={toSelectValue(config.source as string)}
              onValueChange={(value) => onChange({ ...config, source: fromSelectValue(value) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Any Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_VALUE}>Any Source</SelectItem>
                <SelectItem value="widget">Widget</SelectItem>
                <SelectItem value="voice">Voice</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="api">API</SelectItem>
                <SelectItem value="import">Import</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fields Changed (Optional, comma-separated)</Label>
            <Input
              value={(config.fields_changed as string[])?.join(', ') || ''}
              onChange={(e) =>
                onChange({
                  ...config,
                  fields_changed: e.target.value.split(',').map((f) => f.trim()).filter(Boolean),
                })
              }
              placeholder="email, phone, name"
            />
            <p className="text-xs text-muted-foreground mt-1">Only trigger if these fields were changed</p>
          </div>
        </div>
      )
    case 'deal_created':
      return (
        <div className="space-y-4">
          <div>
            <Label>Stage (Optional)</Label>
            <Select
              value={toSelectValue(config.stage as string)}
              onValueChange={(value) => onChange({ ...config, stage: fromSelectValue(value) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Any Stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_VALUE}>Any Stage</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="proposal">Proposal</SelectItem>
                <SelectItem value="negotiation">Negotiation</SelectItem>
                <SelectItem value="closed-won">Closed Won</SelectItem>
                <SelectItem value="closed-lost">Closed Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Minimum Value (Optional)</Label>
            <Input
              type="number"
              min="0"
              value={(config.min_value as number) || ''}
              onChange={(e) => onChange({ ...config, min_value: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground mt-1">Only trigger if deal value is at least this amount</p>
          </div>
          <div>
            <Label>Contact ID (Optional)</Label>
            <Input
              value={(config.contact_id as string) || ''}
              onChange={(e) => onChange({ ...config, contact_id: e.target.value || undefined })}
              placeholder="Leave empty for any contact"
            />
          </div>
        </div>
      )
    case 'deal_stage_changed':
      return (
        <div className="space-y-4">
          <div>
            <Label>From Stage (Optional)</Label>
            <Select
              value={toSelectValue(config.from_stage as string)}
              onValueChange={(value) => onChange({ ...config, from_stage: fromSelectValue(value) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Any Stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_VALUE}>Any Stage</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="proposal">Proposal</SelectItem>
                <SelectItem value="negotiation">Negotiation</SelectItem>
                <SelectItem value="closed-won">Closed Won</SelectItem>
                <SelectItem value="closed-lost">Closed Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>To Stage (Optional)</Label>
            <Select
              value={toSelectValue(config.to_stage as string)}
              onValueChange={(value) => onChange({ ...config, to_stage: fromSelectValue(value) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Any Stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_VALUE}>Any Stage</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="proposal">Proposal</SelectItem>
                <SelectItem value="negotiation">Negotiation</SelectItem>
                <SelectItem value="closed-won">Closed Won</SelectItem>
                <SelectItem value="closed-lost">Closed Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Deal ID (Optional)</Label>
            <Input
              value={(config.deal_id as string) || ''}
              onChange={(e) => onChange({ ...config, deal_id: e.target.value || undefined })}
              placeholder="Leave empty for any deal"
            />
          </div>
        </div>
      )
    case 'message_received':
      return (
        <div className="space-y-4">
          <div>
            <Label>Keywords (Optional, comma-separated)</Label>
            <Input
              value={(config.keywords as string[])?.join(', ') || ''}
              onChange={(e) =>
                onChange({
                  ...config,
                  keywords: e.target.value.split(',').map((k) => k.trim()).filter(Boolean),
                })
              }
              placeholder="urgent, help, question"
            />
            <p className="text-xs text-muted-foreground mt-1">Only trigger if message contains any of these keywords</p>
          </div>
          <div>
            <Label>Agent ID (Optional)</Label>
            <Select
              value={toSelectValue(config.agent_id as string)}
              onValueChange={(value) => onChange({ ...config, agent_id: fromSelectValue(value) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Any Agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_VALUE}>Any Agent</SelectItem>
                {agents?.map((agent: Agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Channel (Optional)</Label>
            <Select
              value={toSelectValue(config.channel as string)}
              onValueChange={(value) => onChange({ ...config, channel: fromSelectValue(value) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Any Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_VALUE}>Any Channel</SelectItem>
                <SelectItem value="chat">Chat</SelectItem>
                <SelectItem value="voice">Voice</SelectItem>
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )
    case 'webhook':
      return (
        <div className="space-y-4">
          <div>
            <Label>Webhook Path</Label>
            <Input
              value={(config.webhook_path as string) || ''}
              onChange={(e) => onChange({ ...config, webhook_path: e.target.value })}
              placeholder="my-webhook"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Unique path for this webhook. URL will be: /api/webhooks/{'{'}workflow_id{'}'}/your-path
            </p>
          </div>
          <div>
            <Label>Method (Optional)</Label>
            <Select
              value={(config.method as string) || 'POST'}
              onValueChange={(value) => onChange({ ...config, method: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="PATCH">PATCH</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Secret (Optional)</Label>
            <Input
              type="password"
              value={(config.secret as string) || ''}
              onChange={(e) => onChange({ ...config, secret: e.target.value || undefined })}
              placeholder="webhook-secret-key"
            />
            <p className="text-xs text-muted-foreground mt-1">Optional secret for webhook authentication</p>
          </div>
        </div>
      )
    default:
      return (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            No specific configuration available for this trigger type.
          </div>
        </div>
      )
  }
}

function ConditionConfigForm({
  config,
  onChange,
}: {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Field</Label>
        <Input
          value={(config.field as string) || ''}
          onChange={(e) => onChange({ ...config, field: e.target.value })}
          placeholder="contact.email"
        />
      </div>
      <div>
        <Label>Operator</Label>
        <Select
          value={(config.operator as string) || 'equals'}
          onValueChange={(value) => onChange({ ...config, operator: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select operator" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="equals">Equals</SelectItem>
            <SelectItem value="not_equals">Not Equals</SelectItem>
            <SelectItem value="contains">Contains</SelectItem>
            <SelectItem value="not_contains">Not Contains</SelectItem>
            <SelectItem value="greater_than">Greater Than</SelectItem>
            <SelectItem value="less_than">Less Than</SelectItem>
            <SelectItem value="greater_than_or_equal">Greater Than or Equal</SelectItem>
            <SelectItem value="less_than_or_equal">Less Than or Equal</SelectItem>
            <SelectItem value="is_empty">Is Empty</SelectItem>
            <SelectItem value="is_not_empty">Is Not Empty</SelectItem>
            <SelectItem value="exists">Exists</SelectItem>
            <SelectItem value="not_exists">Not Exists</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Value</Label>
        <Input
          value={(config.value as string) || ''}
          onChange={(e) => onChange({ ...config, value: e.target.value })}
          placeholder="Value to compare"
        />
      </div>
    </div>
  )
}

function ActionConfigForm({
  nodeType,
  config,
  onChange,
}: {
  nodeType: string
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
}) {
  switch (nodeType) {
    case 'create_deal':
      return (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Deal Title</Label>
              <VariableHelper context="deal" onInsert={(varText) => {
                const current = (config.title as string) || ''
                onChange({ ...config, title: current + varText })
              }} />
            </div>
            <Input
              value={(config.title as string) || ''}
              onChange={(e) => onChange({ ...config, title: e.target.value })}
              placeholder="New Deal - {{contact.name}}"
            />
          </div>
          <div>
            <Label>Deal Value</Label>
            <Input
              type="number"
              value={(config.value as number) || 0}
              onChange={(e) => onChange({ ...config, value: parseFloat(e.target.value) })}
              placeholder="500"
            />
          </div>
          <div>
            <Label>Stage</Label>
            <Select
              value={(config.stage as string) || 'lead'}
              onValueChange={(value) => onChange({ ...config, stage: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="proposal">Proposal</SelectItem>
                <SelectItem value="negotiation">Negotiation</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )
    case 'add_tag':
      return (
        <div className="space-y-4">
          <div>
            <Label>Contact ID</Label>
            <Input
              value={(config.contact_id as string) || 'auto'}
              onChange={(e) => onChange({ ...config, contact_id: e.target.value })}
              placeholder="auto or contact ID"
            />
            <p className="text-xs text-muted-foreground mt-1">Use "auto" to use contact from context</p>
          </div>
          <div>
            <Label>Tags</Label>
            <Input
              value={(config.tags as string[])?.join(', ') || ''}
              onChange={(e) =>
                onChange({
                  ...config,
                  tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                })
              }
              placeholder="tag1, tag2, tag3"
            />
          </div>
        </div>
      )
    case 'update_contact':
      return (
        <div className="space-y-4">
          <div>
            <Label>Contact ID</Label>
            <Input
              value={(config.contact_id as string) || 'auto'}
              onChange={(e) => onChange({ ...config, contact_id: e.target.value })}
              placeholder="auto or contact ID"
            />
            <p className="text-xs text-muted-foreground mt-1">Use "auto" to use contact from context</p>
          </div>
          <div>
            <Label>Add Tags (comma-separated)</Label>
            <Input
              value={(config.add_tags as string[])?.join(', ') || ''}
              onChange={(e) =>
                onChange({
                  ...config,
                  add_tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                })
              }
              placeholder="tag1, tag2, tag3"
            />
          </div>
          <div>
            <Label>Remove Tags (comma-separated)</Label>
            <Input
              value={(config.remove_tags as string[])?.join(', ') || ''}
              onChange={(e) =>
                onChange({
                  ...config,
                  remove_tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                })
              }
              placeholder="tag1, tag2, tag3"
            />
          </div>
          <div>
            <KeyValueEditor
              value={(config.metadata as Record<string, unknown>) || {}}
              onChange={(value) => onChange({ ...config, metadata: value })}
              label="Metadata"
              keyPlaceholder="Key"
              valuePlaceholder="Value"
            />
          </div>
        </div>
      )
    case 'update_deal':
      return (
        <div className="space-y-4">
          <div>
            <Label>Deal ID</Label>
            <Input
              value={(config.deal_id as string) || 'auto'}
              onChange={(e) => onChange({ ...config, deal_id: e.target.value })}
              placeholder="auto or deal ID"
            />
            <p className="text-xs text-muted-foreground mt-1">Use "auto" to use deal from context</p>
          </div>
          <div>
            <Label>Title</Label>
            <Input
              value={(config.fields as Record<string, unknown>)?.title as string || ''}
              onChange={(e) =>
                onChange({
                  ...config,
                  fields: {
                    ...((config.fields as Record<string, unknown>) || {}),
                    title: e.target.value,
                  },
                })
              }
              placeholder="Deal title"
            />
          </div>
          <div>
            <Label>Value</Label>
            <Input
              type="number"
              value={(config.fields as Record<string, unknown>)?.value as number || 0}
              onChange={(e) =>
                onChange({
                  ...config,
                  fields: {
                    ...((config.fields as Record<string, unknown>) || {}),
                    value: parseFloat(e.target.value) || 0,
                  },
                })
              }
              placeholder="500"
            />
          </div>
          <div>
            <Label>Stage</Label>
            <Select
              value={(config.fields as Record<string, unknown>)?.stage as string || 'lead'}
              onValueChange={(value) =>
                onChange({
                  ...config,
                  fields: {
                    ...((config.fields as Record<string, unknown>) || {}),
                    stage: value,
                  },
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="proposal">Proposal</SelectItem>
                <SelectItem value="negotiation">Negotiation</SelectItem>
                <SelectItem value="closed-won">Closed Won</SelectItem>
                <SelectItem value="closed-lost">Closed Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Probability (0-100)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={(config.fields as Record<string, unknown>)?.probability as number || 0}
              onChange={(e) =>
                onChange({
                  ...config,
                  fields: {
                    ...((config.fields as Record<string, unknown>) || {}),
                    probability: parseInt(e.target.value) || 0,
                  },
                })
              }
              placeholder="50"
            />
          </div>
          <div>
            <Label>Expected Close Date</Label>
            <Input
              type="date"
              value={(config.fields as Record<string, unknown>)?.expected_close_date as string || ''}
              onChange={(e) =>
                onChange({
                  ...config,
                  fields: {
                    ...((config.fields as Record<string, unknown>) || {}),
                    expected_close_date: e.target.value,
                  },
                })
              }
            />
          </div>
          <div>
            <KeyValueEditor
              value={(config.metadata as Record<string, unknown>) || {}}
              onChange={(value) => onChange({ ...config, metadata: value })}
              label="Metadata"
              keyPlaceholder="Key"
              valuePlaceholder="Value"
            />
          </div>
        </div>
      )
    case 'send_webhook':
      return (
        <div className="space-y-4">
          <div>
            <Label>URL</Label>
            <Input
              value={(config.url as string) || ''}
              onChange={(e) => onChange({ ...config, url: e.target.value })}
              placeholder="https://example.com/webhook"
            />
          </div>
          <div>
            <Label>Method</Label>
            <Select
              value={(config.method as string) || 'POST'}
              onValueChange={(value) => onChange({ ...config, method: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="PATCH">PATCH</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <KeyValueEditor
              value={(config.headers as Record<string, string>) || {}}
              onChange={(value) => onChange({ ...config, headers: value as Record<string, string> })}
              label="Headers"
              keyPlaceholder="Header name"
              valuePlaceholder="Header value"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Body (JSON)</Label>
              <VariableHelper context="webhook" />
            </div>
            <textarea
              className="w-full p-2 border rounded text-sm font-mono"
              rows={6}
              value={JSON.stringify((config.body as unknown) || {}, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value)
                  onChange({ ...config, body: parsed })
                } catch {
                  // Invalid JSON, keep as is
                }
              }}
              placeholder={'{"key": "value", "{{contact.name}}": "variable"}'}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Enter valid JSON. Use {'{'} {'{'}{'variable'}{'}'} {'}'} for dynamic values
            </p>
          </div>
        </div>
      )
    case 'send_notification':
      return (
        <div className="space-y-4">
          <div>
            <Label>To (User ID or Email)</Label>
            <Input
              value={(config.to as string) || ''}
              onChange={(e) => onChange({ ...config, to: e.target.value })}
              placeholder="user@example.com or user_id"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Title</Label>
              <VariableHelper context="default" onInsert={(varText) => {
                const current = (config.title as string) || ''
                onChange({ ...config, title: current + varText })
              }} />
            </div>
            <Input
              value={(config.title as string) || ''}
              onChange={(e) => onChange({ ...config, title: e.target.value })}
              placeholder={'Notification Title - {{contact.name}}'}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Message</Label>
              <VariableHelper context="default" onInsert={(varText) => {
                const current = (config.message as string) || ''
                onChange({ ...config, message: current + varText })
              }} />
            </div>
            <textarea
              className="w-full p-2 border rounded"
              rows={4}
              value={(config.message as string) || ''}
              onChange={(e) => onChange({ ...config, message: e.target.value })}
              placeholder={'Notification message - {{contact.name}} has shown interest'}
            />
          </div>
          <div>
            <Label>Notification Type</Label>
            <Select
              value={(config.notification_type as string) || 'in_app'}
              onValueChange={(value) => onChange({ ...config, notification_type: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select notification type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_app">In-App</SelectItem>
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )
    case 'update_conversation_metadata':
      return (
        <div className="space-y-4">
          <div>
            <Label>Conversation ID</Label>
            <Input
              value={(config.conversation_id as string) || 'auto'}
              onChange={(e) => onChange({ ...config, conversation_id: e.target.value })}
              placeholder="auto or conversation ID"
            />
            <p className="text-xs text-muted-foreground mt-1">Use "auto" to use conversation from context</p>
          </div>
          <div>
            <KeyValueEditor
              value={(config.metadata as Record<string, unknown>) || {}}
              onChange={(value) => onChange({ ...config, metadata: value })}
              label="Metadata"
              keyPlaceholder="Key"
              valuePlaceholder="Value"
            />
          </div>
        </div>
      )
    default:
      return <div className="text-sm text-muted-foreground">Configuration coming soon</div>
  }
}


