import { useState, useEffect, useRef } from 'react'
import { toast } from 'react-toastify'

/**
 * Video Call Room Component
 * WebRTC-based audio/video consultation room
 * Author: David Gabion Selorm
 */

const VideoCallRoom = ({ consultation, onEndCall, currentUser }) => {
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [isAudioMuted, setIsAudioMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [callStatus, setCallStatus] = useState('connecting') // connecting, connected, disconnected
  const [callDuration, setCallDuration] = useState(0)
  const [callMode, setCallMode] = useState('video') // 'video' or 'audio'
  const [pendingModeRequest, setPendingModeRequest] = useState(null)
  const [showModeRequestDialog, setShowModeRequestDialog] = useState(false)

  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const peerConnectionRef = useRef(null)
  const timerRef = useRef(null)

  // WebRTC Configuration
  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  }

  useEffect(() => {
    initializeCall()
    return () => cleanup()
  }, [])

  useEffect(() => {
    if (callStatus === 'connected') {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1)
      }, 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [callStatus])

  const initializeCall = async (mode = 'video') => {
    try {
      // Get user media based on call mode
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: mode === 'video' ? {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } : false
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)

      setLocalStream(stream)
      setCallMode(mode)
      
      if (localVideoRef.current && mode === 'video') {
        localVideoRef.current.srcObject = stream
      }

      // Create peer connection
      const peerConnection = new RTCPeerConnection(configuration)
      peerConnectionRef.current = peerConnection

      // Add local stream tracks to peer connection
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream)
      })

      // Handle incoming tracks
      peerConnection.ontrack = (event) => {
        const [remoteStream] = event.streams
        setRemoteStream(remoteStream)
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream
        }
        setCallStatus('connected')
        toast.success('Connected to call!')
      }

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          // In production, send this to signaling server
          console.log('ICE candidate:', event.candidate)
        }
      }

      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnection.connectionState)
        if (peerConnection.connectionState === 'connected') {
          setCallStatus('connected')
        } else if (peerConnection.connectionState === 'disconnected' || 
                   peerConnection.connectionState === 'failed') {
          setCallStatus('disconnected')
          toast.error('Call disconnected')
        }
      }

      // Simulate connection for demo (in production, use signaling server)
      setTimeout(() => {
        setCallStatus('connected')
      }, 2000)

      if (mode === 'audio') {
        toast.info('Initializing audio call...')
      } else {
        toast.info('Initializing video call...')
      }
    } catch (error) {
      console.error('Error initializing call:', error)
      toast.error('Failed to access camera/microphone. Please check permissions.')
      setCallStatus('disconnected')
    }
  }

  const requestModeSwitch = async (newMode) => {
    // In production, send this request to the other party via signaling server
    // For demo, show confirmation dialog
    const modeName = newMode === 'audio' ? 'audio-only' : 'video'
    
    toast.info(`Requesting switch to ${modeName} mode...`)
    
    // Simulate request being sent
    setPendingModeRequest(newMode)
    
    // Auto-approve after 2 seconds for demo (in production, other party approves)
    setTimeout(() => {
      handleModeRequestApproval(newMode)
    }, 2000)
  }

  const handleModeRequestApproval = async (approvedMode) => {
    try {
      if (approvedMode === 'audio' && callMode === 'video') {
        // Switch from video to audio-only
        const videoTrack = localStream?.getVideoTracks()[0]
        if (videoTrack) {
          videoTrack.stop()
          localStream.removeTrack(videoTrack)
        }
        setCallMode('audio')
        toast.success('Switched to audio-only mode')
      } else if (approvedMode === 'video' && callMode === 'audio') {
        // Switch from audio-only to video
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        })
        
        const videoTrack = videoStream.getVideoTracks()[0]
        localStream.addTrack(videoTrack)
        
        // Replace track in peer connection
        const sender = peerConnectionRef.current
          ?.getSenders()
          .find(s => s.track === null || s.track?.kind === 'video')
        
        if (sender) {
          sender.replaceTrack(videoTrack)
        } else {
          peerConnectionRef.current?.addTrack(videoTrack, localStream)
        }
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream
        }
        
        setCallMode('video')
        toast.success('Switched to video mode')
      }
      setPendingModeRequest(null)
    } catch (error) {
      console.error('Error switching mode:', error)
      toast.error('Failed to switch call mode')
      setPendingModeRequest(null)
    }
  }

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsAudioMuted(!audioTrack.enabled)
        toast.info(audioTrack.enabled ? 'Microphone unmuted' : 'Microphone muted')
      }
    }
  }

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsVideoOff(!videoTrack.enabled)
        toast.info(videoTrack.enabled ? 'Camera on' : 'Camera off')
      }
    }
  }

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: false
        })

        const screenTrack = screenStream.getVideoTracks()[0]
        
        // Replace video track
        const sender = peerConnectionRef.current
          ?.getSenders()
          .find(s => s.track?.kind === 'video')

        if (sender) {
          sender.replaceTrack(screenTrack)
        }

        // Update local video
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream
        }

        screenTrack.onended = () => {
          stopScreenShare()
        }

        setIsScreenSharing(true)
        toast.success('Screen sharing started')
      } else {
        stopScreenShare()
      }
    } catch (error) {
      console.error('Error sharing screen:', error)
      toast.error('Failed to share screen')
    }
  }

  const stopScreenShare = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0]
      const sender = peerConnectionRef.current
        ?.getSenders()
        .find(s => s.track?.kind === 'video')

      if (sender && videoTrack) {
        sender.replaceTrack(videoTrack)
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream
      }

      setIsScreenSharing(false)
      toast.info('Screen sharing stopped')
    }
  }

  const cleanup = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop())
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop())
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
  }

  const handleEndCall = () => {
    cleanup()
    onEndCall(callDuration)
  }

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold text-lg">
            {consultation?.patients?.name || 'Video Consultation'}
          </h3>
          <p className="text-gray-400 text-sm">
            {callStatus === 'connecting' && '🔄 Connecting...'}
            {callStatus === 'connected' && `📞 Connected • ${formatDuration(callDuration)}`}
            {callStatus === 'disconnected' && '❌ Disconnected'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-gray-700 px-3 py-1 rounded text-white text-sm font-medium">
            {formatDuration(callDuration)}
          </div>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 relative bg-black">
        {/* Call Mode Indicator */}
        {callMode === 'audio' && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-full font-medium shadow-lg z-10">
            🎧 Audio-Only Mode
          </div>
        )}

        {/* Remote Video/Audio (Main) */}
        <div className="w-full h-full flex items-center justify-center">
          {callStatus === 'connected' && remoteStream && callMode === 'video' ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-center text-white">
              <div className="w-32 h-32 bg-gray-700 rounded-full mx-auto mb-4 flex items-center justify-center text-5xl">
                {callMode === 'audio' ? '🎧' : '👤'}
              </div>
              <p className="text-xl font-semibold mb-2">
                {callStatus === 'connecting' ? 'Connecting...' : 
                 callMode === 'audio' ? 'Audio Call Active' : 'Waiting for other participant'}
              </p>
              <p className="text-gray-400">
                {consultation?.patients?.name}
              </p>
              {callMode === 'audio' && callStatus === 'connected' && (
                <p className="text-sm text-gray-500 mt-2">
                  Video is disabled for this call
                </p>
              )}
            </div>
          )}
        </div>

        {/* Local Video (Picture-in-Picture) - Only show in video mode */}
        {callMode === 'video' && (
          <div className="absolute top-4 right-4 w-64 h-48 bg-gray-800 rounded-lg overflow-hidden shadow-2xl border-2 border-gray-600">
            {isVideoOff ? (
              <div className="w-full h-full flex items-center justify-center text-white bg-gray-700">
                <div className="text-center">
                  <div className="text-4xl mb-2">📷</div>
                  <p className="text-sm">Camera Off</p>
                </div>
              </div>
            ) : (
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover mirror"
              />
            )}
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 px-2 py-1 rounded text-white text-xs">
              You {isScreenSharing && '(Sharing Screen)'}
            </div>
          </div>
        )}

        {/* Connection Status Indicator */}
        {callStatus === 'connecting' && (
          <div className="absolute top-4 left-4 bg-yellow-500 text-black px-4 py-2 rounded-lg font-medium">
            🔄 Connecting...
          </div>
        )}
        {callStatus === 'disconnected' && (
          <div className="absolute top-4 left-4 bg-red-500 text-white px-4 py-2 rounded-lg font-medium">
            ❌ Connection Lost
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-800 px-6 py-6">
        <div className="flex items-center justify-center gap-4">
          {/* Mute/Unmute Audio */}
          <button
            onClick={toggleAudio}
            className={`${
              isAudioMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
            } text-white p-4 rounded-full transition-all shadow-lg`}
            title={isAudioMuted ? 'Unmute' : 'Mute'}
          >
            {isAudioMuted ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </button>

          {/* Video On/Off - Only show in video mode */}
          {callMode === 'video' && (
            <button
              onClick={toggleVideo}
              className={`${
                isVideoOff ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
              } text-white p-4 rounded-full transition-all shadow-lg`}
              title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
            >
              {isVideoOff ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          )}

          {/* Switch Mode (Audio/Video) */}
          <button
            onClick={() => requestModeSwitch(callMode === 'video' ? 'audio' : 'video')}
            disabled={pendingModeRequest !== null}
            className={`${
              pendingModeRequest ? 'bg-yellow-600 opacity-50 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'
            } text-white p-4 rounded-full transition-all shadow-lg relative`}
            title={callMode === 'video' ? 'Switch to audio-only' : 'Request video mode'}
          >
            {pendingModeRequest ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : callMode === 'video' ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>

          {/* Screen Share - Only in video mode */}
          {callMode === 'video' && (
            <button
              onClick={toggleScreenShare}
              className={`${
                isScreenSharing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
              } text-white p-4 rounded-full transition-all shadow-lg`}
              title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </button>
          )}

          {/* End Call */}
          <button
            onClick={handleEndCall}
            className="bg-red-600 hover:bg-red-700 text-white p-4 rounded-full transition-all shadow-lg"
            title="End call"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
            </svg>
          </button>
        </div>

        {/* Info Text */}
        <div className="text-center text-gray-400 text-sm mt-4">
          {callMode === 'video' ? (
            <>Use headphones for better audio quality • Screen sharing available • Switch to audio-only mode anytime</>
          ) : (
            <>Audio-only mode active • Request video mode to enable camera</>
          )}
        </div>
      </div>

      {/* CSS for mirror effect on local video */}
      <style>{`
        .mirror {
          transform: scaleX(-1);
        }
      `}</style>
    </div>
  )
}

export default VideoCallRoom
