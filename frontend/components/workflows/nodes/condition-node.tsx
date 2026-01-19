"use client"

import { memo } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { Card, CardContent } from '@/components/ui/card'
import { HelpCircle } from 'lucide-react'

export const ConditionNode = memo(({ data, selected }: NodeProps) => {
  return (
    <Card className={`min-w-[200px] ${selected ? 'ring-2 ring-primary' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <HelpCircle className="h-4 w-4 text-blue-500" />
          <span className="font-semibold text-sm">{data.label || 'IF Condition'}</span>
        </div>
        <div className="flex gap-2">
          <Handle type="target" position={Position.Top} />
          <div className="flex-1 flex justify-between">
            <Handle
              type="source"
              position={Position.Bottom}
              id="yes"
              style={{ left: '30%' }}
            />
            <Handle
              type="source"
              position={Position.Bottom}
              id="no"
              style={{ left: '70%' }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

ConditionNode.displayName = 'ConditionNode'











