"use client"

import { useCallback } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Zap,
  MessageSquare,
  User,
  Briefcase,
  HelpCircle,
  Tag,
  Edit,
  Webhook,
  Bell,
  FileText,
  CheckCircle,
  UserCog,
  TrendingUp,
  Mail,
  Globe,
} from 'lucide-react'

const TRIGGER_NODES = [
  {
    type: 'trigger',
    nodeType: 'purchase_intent',
    label: 'Purchase Intent',
    icon: Zap,
    description: 'Triggered when purchase intent is detected',
    color: 'text-yellow-500',
    borderColor: 'border-l-yellow-500',
  },
  {
    type: 'trigger',
    nodeType: 'conversation_started',
    label: 'Conversation Started',
    icon: MessageSquare,
    description: 'Triggered when a conversation begins',
    color: 'text-blue-500',
    borderColor: 'border-l-blue-500',
  },
  {
    type: 'trigger',
    nodeType: 'conversation_ended',
    label: 'Conversation Ended',
    icon: CheckCircle,
    description: 'Triggered when a conversation ends',
    color: 'text-emerald-500',
    borderColor: 'border-l-emerald-500',
  },
  {
    type: 'trigger',
    nodeType: 'contact_created',
    label: 'Contact Created',
    icon: User,
    description: 'Triggered when a contact is created',
    color: 'text-green-500',
    borderColor: 'border-l-green-500',
  },
  {
    type: 'trigger',
    nodeType: 'contact_updated',
    label: 'Contact Updated',
    icon: UserCog,
    description: 'Triggered when a contact is updated',
    color: 'text-lime-500',
    borderColor: 'border-l-lime-500',
  },
  {
    type: 'trigger',
    nodeType: 'deal_created',
    label: 'Deal Created',
    icon: Briefcase,
    description: 'Triggered when a deal is created',
    color: 'text-orange-500',
    borderColor: 'border-l-orange-500',
  },
  {
    type: 'trigger',
    nodeType: 'deal_stage_changed',
    label: 'Deal Stage Changed',
    icon: TrendingUp,
    description: 'Triggered when a deal stage changes',
    color: 'text-amber-500',
    borderColor: 'border-l-amber-500',
  },
  {
    type: 'trigger',
    nodeType: 'message_received',
    label: 'Message Received',
    icon: Mail,
    description: 'Triggered when a message is received',
    color: 'text-cyan-500',
    borderColor: 'border-l-cyan-500',
  },
  {
    type: 'trigger',
    nodeType: 'webhook',
    label: 'Webhook',
    icon: Globe,
    description: 'Triggered by incoming webhook request',
    color: 'text-purple-500',
    borderColor: 'border-l-purple-500',
  },
]

const CONDITION_NODES = [
  {
    type: 'condition',
    nodeType: 'if',
    label: 'IF Condition',
    icon: HelpCircle,
    description: 'Check if condition is true',
    color: 'text-purple-500',
    borderColor: 'border-l-purple-500',
  },
]

const ACTION_NODES = [
  {
    type: 'action',
    nodeType: 'create_deal',
    label: 'Create Deal',
    icon: Briefcase,
    description: 'Create a new deal',
    color: 'text-orange-500',
    borderColor: 'border-l-orange-500',
  },
  {
    type: 'action',
    nodeType: 'update_contact',
    label: 'Update Contact',
    icon: User,
    description: 'Update contact information',
    color: 'text-cyan-500',
    borderColor: 'border-l-cyan-500',
  },
  {
    type: 'action',
    nodeType: 'update_deal',
    label: 'Update Deal',
    icon: Edit,
    description: 'Update deal information',
    color: 'text-amber-500',
    borderColor: 'border-l-amber-500',
  },
  {
    type: 'action',
    nodeType: 'add_tag',
    label: 'Add Tag',
    icon: Tag,
    description: 'Add tag to contact',
    color: 'text-pink-500',
    borderColor: 'border-l-pink-500',
  },
  {
    type: 'action',
    nodeType: 'send_notification',
    label: 'Send Notification',
    icon: Bell,
    description: 'Send in-app or email notification',
    color: 'text-indigo-500',
    borderColor: 'border-l-indigo-500',
  },
  {
    type: 'action',
    nodeType: 'send_webhook',
    label: 'Send Webhook',
    icon: Webhook,
    description: 'Send HTTP webhook request',
    color: 'text-teal-500',
    borderColor: 'border-l-teal-500',
  },
  {
    type: 'action',
    nodeType: 'update_conversation_metadata',
    label: 'Update Conversation Metadata',
    icon: FileText,
    description: 'Update conversation metadata',
    color: 'text-violet-500',
    borderColor: 'border-l-violet-500',
  },
]

export function NodePalette() {
  const onDragStart = useCallback(
    (event: React.DragEvent, nodeType: string, nodeTypeSpecific: string) => {
      event.dataTransfer.setData('application/reactflow', JSON.stringify({
        type: nodeType,
        nodeType: nodeTypeSpecific,
      }))
      event.dataTransfer.effectAllowed = 'move'
    },
    []
  )

  const NodeItem = ({ node }: { node: typeof TRIGGER_NODES[0] }) => {
    const Icon = node.icon
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={`
                group relative flex items-center gap-2 px-3 py-2 
                border-l-2 ${node.borderColor}
                bg-muted/30 hover:bg-muted/50 
                cursor-grab active:cursor-grabbing
                transition-colors duration-150
                rounded-r-sm
              `}
              draggable
              onDragStart={(e) => onDragStart(e, node.type, node.nodeType)}
            >
              <Icon className={`h-4 w-4 ${node.color} flex-shrink-0`} />
              <span className="text-sm font-medium text-foreground truncate">
                {node.label}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <p className="text-xs">{node.description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div className="w-56 border-r bg-background overflow-y-auto flex flex-col">
      {/* Node Categories */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4 pt-3">
        {/* Triggers */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-2">
            Triggers
          </h3>
          <div className="space-y-1">
            {TRIGGER_NODES.map((node) => (
              <NodeItem key={node.nodeType} node={node} />
            ))}
          </div>
        </div>

        {/* Conditions */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-2">
            Conditions
          </h3>
          <div className="space-y-1">
            {CONDITION_NODES.map((node) => (
              <NodeItem key={node.nodeType} node={node} />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-2">
            Actions
          </h3>
          <div className="space-y-1">
            {ACTION_NODES.map((node) => (
              <NodeItem key={node.nodeType} node={node} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

