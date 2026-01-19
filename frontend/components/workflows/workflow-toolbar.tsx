"use client"

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Save, X, TestTube } from 'lucide-react'
import type { Workflow } from '@syntera/shared'
import { useState } from 'react'

interface WorkflowToolbarProps {
  workflow: Workflow
  onSave: (data: { name: string; description?: string }) => Promise<void>
  onCancel: () => void
  isNew?: boolean
}

export function WorkflowToolbar({
  workflow,
  onSave,
  onCancel,
  isNew = false,
}: WorkflowToolbarProps) {
  const [name, setName] = useState(workflow.name)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave({
        name,
        description: workflow.description || '',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex-1 flex items-center gap-3">
        <div className="flex-1 max-w-md">
          <Label htmlFor="workflow-name" className="sr-only">
            Workflow Name
          </Label>
          <Input
            id="workflow-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Workflow name"
            className="font-semibold h-9"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" disabled>
          <TestTube className="h-4 w-4" />
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  )
}

