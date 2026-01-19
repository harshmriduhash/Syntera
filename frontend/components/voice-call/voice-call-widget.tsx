'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LiveKitClient, type LiveKitClientCallbacks } from '@/lib/livekit/client'
import { useGenerateLiveKitToken, useDeployVoiceBot } from '@/lib/api/livekit'
import { useConversation, useUpdateConversation } from '@/lib/api/chat'
import { Mic, MicOff, PhoneOff, Loader2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { logger } from '@/lib/utils/logger'

interface VoiceCallWidgetProps {
  conversationId: string
  agentId: string
}

export function VoiceCallWidget({ conversationId, agentId }: VoiceCallWidgetProps) {
  const [client] = useState(() => new LiveKitClient())
  const [isConnected, setIsConnected] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [participants, setParticipants] = useState<string[]>([])
  const [isConnecting, setIsConnecting] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)
  const [agentDeployed, setAgentDeployed] = useState(false)
  const generateToken = useGenerateLiveKitToken()
  const deployBot = useDeployVoiceBot()
  const updateConversation = useUpdateConversation()
  const { data: conversationData } = useConversation(conversationId)
  const audioRef = useRef<HTMLAudioElement>(null)
  const callStartTimeRef = useRef<Date | null>(null)

  const connectToRoom = useCallback(async () => {
    if (isConnecting || isConnected) return

    setIsConnecting(true)
    try {
      const tokenData = await generateToken.mutateAsync({
        conversationId,
        agentId,
        participantType: 'user',
      })

      const callbacks: LiveKitClientCallbacks = {
        onParticipantConnected: (participant) => {
          setParticipants((prev) => [...prev, participant.identity])
        },
        onParticipantDisconnected: (participant) => {
          setParticipants((prev) => prev.filter((id) => id !== participant.identity))
        },
        onTrackSubscribed: (track) => {
          if (track.kind === 'audio' && audioRef.current) {
            track.attach(audioRef.current)
          }
        },
        onDisconnected: () => {
          setIsConnected(false)
          setParticipants([])
        },
        onError: (error) => {
          toast.error(`Connection error: ${error.message}`)
          setIsConnected(false)
        },
      }

      await client.connect(tokenData.token, tokenData.url, callbacks)
      setIsConnected(true)
      callStartTimeRef.current = new Date()
      toast.success('Connected to voice call')

      // Enable microphone - required for backend to receive audio input
      try {
        await client.enableAudio()
        setIsMuted(false)
      } catch (error) {
        logger.error('Failed to enable microphone', { error, conversationId, agentId })
        toast.error('Failed to enable microphone. Please check permissions.')
        setIsMuted(true)
      }

      // Automatically deploy the agent after successful connection
      if (!agentDeployed) {
        setIsDeploying(true)
        try {
          await deployBot.mutateAsync({
            conversationId,
            agentId,
          })
          setAgentDeployed(true)
        } catch (error) {
          logger.error('Failed to deploy agent', { error, conversationId, agentId })
        } finally {
          setIsDeploying(false)
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to voice call'
      logger.error('LiveKit connection failed', { error, conversationId, agentId })
      toast.error(errorMessage)
      setIsConnected(false)
    } finally {
      setIsConnecting(false)
    }
  }, [client, conversationId, agentId, generateToken, deployBot, isConnecting, isConnected, agentDeployed])

  const disconnect = useCallback(async () => {
    try {
      // Update conversation status to 'ended' and set ended_at timestamp
      try {
        await updateConversation.mutateAsync({
          id: conversationId,
          data: {
            status: 'ended',
            metadata: {
            ended_at: new Date().toISOString(),
            },
          },
        })
      } catch (error) {
        logger.error('Failed to update conversation status', { error, conversationId })
        // Don't block disconnect if this fails
      }

      await client.disconnect()
      setIsConnected(false)
      setParticipants([])
      callStartTimeRef.current = null
      toast.info('Disconnected from voice call')
    } catch (error) {
      toast.error('Failed to disconnect')
    }
  }, [client, updateConversation, conversationId])

  const toggleMute = useCallback(async () => {
    try {
      const newMutedState = await client.toggleMute()
      setIsMuted(newMutedState)
    } catch (error) {
      toast.error('Failed to toggle mute')
    }
  }, [client])

  // Connect on mount
  useEffect(() => {
    connectToRoom()

    return () => {
      disconnect()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card className="flex flex-col h-[600px]">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Voice Call</h2>
            <p className="text-sm text-muted-foreground">
              {conversationData?.conversation?.channel === 'voice' ? 'Voice' : 'Video'} call with agent
            </p>
          </div>
          <Badge variant={isConnected ? 'default' : 'secondary'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
        {isConnecting ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Connecting to call...</p>
          </div>
        ) : !isConnected ? (
          <div className="flex flex-col items-center gap-4">
            <PhoneOff className="h-16 w-16 text-muted-foreground" />
            <p className="text-muted-foreground">Not connected</p>
            <Button onClick={connectToRoom}>Connect</Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-5 w-5" />
                <span className="text-sm">{participants.length + 1} participants</span>
              </div>
              {isDeploying && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Deploying agent...</span>
                </div>
              )}
              {agentDeployed && !isDeploying && (
                <Badge variant="outline" className="text-xs">
                  Agent deployed
                </Badge>
              )}
            </div>

            <div className="flex gap-4">
              <Button
                variant={isMuted ? 'destructive' : 'outline'}
                size="lg"
                onClick={toggleMute}
                className="rounded-full h-16 w-16 p-0"
              >
                {isMuted ? (
                  <MicOff className="h-6 w-6" />
                ) : (
                  <Mic className="h-6 w-6" />
                )}
              </Button>

              <Button
                variant="destructive"
                size="lg"
                onClick={disconnect}
                className="rounded-full h-16 w-16 p-0"
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
            </div>
          </>
        )}
      </div>

      <audio ref={audioRef} autoPlay />
    </Card>
  )
}

