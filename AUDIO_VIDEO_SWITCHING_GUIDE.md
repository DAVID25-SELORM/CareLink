# Audio/Video Mode Switching Guide

**CareLink HMS - Telemedicine Enhancement**  
*Author: David Gabion Selorm*  
*Date: April 4, 2026*

## 🎯 Overview

CareLink now supports **flexible call modes** with the ability to switch between video and audio-only during a consultation. This feature provides:

- **Privacy Control**: Switch to audio-only when video isn't needed
- **Bandwidth Optimization**: Save bandwidth with audio-only mode
- **Permission-Based**: Mode changes require approval from the other party
- **Seamless Transition**: Switch modes without ending the call

---

## ✨ Features

### 1. **Call Mode Options**

When scheduling a consultation, choose from:

- **🎥 CareLink Video** - Full video calling with option to switch to audio
- **🎧 CareLink Audio Only** - Audio-only call (no video from the start)
- **📹 Zoom** - External Zoom meeting
- **🎥 Google Meet** - External Google Meet
- **💼 Microsoft Teams** - External Teams meeting
- **🌐 Custom Platform** - Your own platform URL

### 2. **Dynamic Mode Switching**

During a video call, participants can:

- **Request to switch to audio-only**: Click the mode switch button (🎧 icon)
- **Request to enable video**: Click the mode switch button (📹 icon) from audio mode
- **Automatic Permission Flow**: Other party is notified and auto-approves (demo mode)

### 3. **Call Modes**

| Mode | Video | Audio | Screen Share | Controls |
|------|-------|-------|--------------|----------|
| **Video** | ✅ | ✅ | ✅ | Mute, Camera, Screen Share, Mode Switch |
| **Audio** | ❌ | ✅ | ❌ | Mute, Mode Switch |

---

## 🚀 How to Use

### **Scheduling a Consultation**

1. Navigate to **Telemedicine** → **Schedule Consultation**
2. Fill in patient details, doctor, date/time
3. Choose **Platform**:
   - Select `🎥 CareLink Video (Built-in)` for video call with switching capability
   - Select `🎧 CareLink Audio Only` for audio-only call
4. Add meeting link (optional for external platforms)
5. Click **Schedule Consultation**

### **Starting a Call**

1. In the consultations list, find your scheduled consultation
2. Click **Join Video Call** or **Join Audio Call** button
3. Allow browser permissions for camera/microphone (video) or microphone only (audio)
4. Wait for the other participant to join

### **Switching Modes During Call**

#### **From Video to Audio-Only**

1. During a video call, click the **🎧 Mode Switch** button
2. System sends permission request to other party
3. Request is auto-approved (in demo; in production, other party approves)
4. Video stops, call continues in audio-only mode
5. Local video preview disappears
6. "🎧 Audio-Only Mode" indicator appears

#### **From Audio to Video**

1. During an audio call, click the **📹 Mode Switch** button
2. System sends permission request to other party
3. Request is auto-approved (in demo)
4. Camera access is requested
5. Video starts streaming
6. Local video preview appears (bottom-right)
7. Mode indicator changes to video

### **Available Controls**

#### **Video Mode**
- **Mute/Unmute** (🎤): Toggle your microphone
- **Camera On/Off** (📹): Turn camera on/off (video still streams black/frozen)
- **Mode Switch** (🎧): Request switch to audio-only
- **Screen Share** (🖥️): Share your screen
- **End Call** (❌): Terminate the consultation

#### **Audio Mode**
- **Mute/Unmute** (🎤): Toggle your microphone
- **Mode Switch** (📹): Request switch to video mode
- **End Call** (❌): Terminate the consultation

---

## 🔧 Technical Details

### **Database Schema**

New columns added to `virtual_consultations`:

```sql
-- Tracks actual call duration in minutes
actual_duration INTEGER

-- Tracks call mode: 'video' or 'audio'
call_mode TEXT DEFAULT 'video' CHECK (call_mode IN ('video', 'audio'))

-- Platform options updated
meeting_platform TEXT CHECK (meeting_platform IN (
  'carelink_video',   -- New: Built-in video
  'carelink_audio',   -- New: Built-in audio-only
  'zoom', 
  'google_meet', 
  'microsoft_teams', 
  'custom'
))
```

### **WebRTC Implementation**

**Initial Call Setup:**
```javascript
// Video mode
getUserMedia({
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  video: { width: { ideal: 1280 }, height: { ideal: 720 } }
})

// Audio mode
getUserMedia({
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  video: false
})
```

**Mode Switching:**
```javascript
// Video → Audio: Stop and remove video track
const videoTrack = localStream.getVideoTracks()[0]
videoTrack.stop()
localStream.removeTrack(videoTrack)

// Audio → Video: Add video track to existing stream
const videoStream = await getUserMedia({ video: {...} })
const videoTrack = videoStream.getVideoTracks()[0]
localStream.addTrack(videoTrack)
peerConnection.getSender().replaceTrack(videoTrack)
```

### **Permission Flow (Production Implementation)**

In production environment with signaling server:

1. **User A** clicks mode switch button
2. **Client A** sends mode change request via WebSocket to signaling server
3. **Signaling Server** forwards request to Client B
4. **Client B** shows permission dialog: "Dr. Smith wants to switch to audio-only mode. Allow?"
5. **User B** clicks "Allow" or "Deny"
6. **Client B** sends response to signaling server
7. **Signaling Server** forwards response to Client A
8. If approved, both clients execute mode change
9. WebRTC tracks are added/removed
10. UI updates on both sides

**Demo Mode (Current):**
- Auto-approves after 2 seconds for testing
- No signaling server needed
- Simulates the permission flow

---

## 🎨 UI Indicators

### **Mode Indicators**

| Indicator | Meaning |
|-----------|---------|
| 🎧 Audio-Only Mode | Call is in audio-only mode (blue badge at top) |
| 📹 Video Active | Video mode active, camera streaming |
| 🔄 Requesting... | Mode switch request pending (spinning icon) |
| 📷 Camera Off | Video off (participant choice, not mode change) |

### **Visual Cues**

- **Video Mode**: Large remote video, small local video (PiP bottom-right)
- **Audio Mode**: Avatar icon (🎧) displayed, no video elements, blue mode badge
- **Transitioning**: Spinner on mode switch button during request

---

## 🔒 Security & Privacy

### **Permission-Based Control**

- **Bilateral Consent**: Both parties must agree to mode changes
- **Cannot Force Video**: Other party can deny video mode request
- **Privacy First**: Easy switch to audio-only anytime

### **Media Access**

- **Video Mode**: Requires camera + microphone permissions
- **Audio Mode**: Requires microphone permission only
- **Permissions Requested**: Only when needed (on call start/mode switch)

### **Data Privacy**

- **Peer-to-Peer**: WebRTC direct connection, no server in media path
- **Encrypted**: DTLS-SRTP encryption for all media streams
- **No Recording**: Calls not recorded by default (feature can be added)

---

## 📊 Use Cases

### **1. Low Bandwidth Scenarios**

**Scenario**: Patient on slow mobile connection  
**Solution**: Start with video, switch to audio-only if connection degrades  
**Benefit**: Call continues smoothly without disconnection

### **2. Privacy Concerns**

**Scenario**: Patient doesn't want to show face (sensitive condition)  
**Solution**: Schedule `CareLink Audio Only` or switch from video to audio  
**Benefit**: Patient feels comfortable, consultation proceeds

### **3. Professional Settings**

**Scenario**: Doctor reviewing records during call  
**Solution**: Switch to audio-only to focus on medical charts  
**Benefit**: Less distraction, maintain professional conversation

### **4. Multi-Tasking**

**Scenario**: Doctor needs to walk to another room during consultation  
**Solution**: Switch to audio-only and continue call via smartphone  
**Benefit**: Consultation not interrupted, flexibility maintained

---

## 🐛 Troubleshooting

### **Mode Switch Button Disabled**

**Cause**: Another mode switch request is pending  
**Solution**: Wait for current request to complete (2 seconds in demo)

### **Camera Permission Denied on Mode Switch**

**Cause**: Browser blocked camera access  
**Solution**: 
1. Click browser address bar lock icon
2. Allow camera permission
3. Try mode switch again

### **Video Not Starting After Switch**

**Cause**: Camera in use by another application  
**Solution**:
1. Close other apps using camera (Zoom, Teams, etc.)
2. Refresh the page
3. Rejoin the call

### **Other Party Can't See My Video**

**Cause**: Track replacement failed in peer connection  
**Solution**:
1. Toggle camera off and on
2. If issue persists, end call and rejoin
3. Check WebRTC connection state in console

---

## 🚀 Future Enhancements

### **Planned Features**

1. **Real-Time Permission Dialog**: Show actual dialog to other party (requires signaling server)
2. **Mode Lock**: Lock call in audio-only mode (e.g., for bandwidth constraints)
3. **Automatic Mode Switching**: Auto-switch to audio-only on poor connection
4. **Bandwidth Indicators**: Show connection quality with mode recommendations
5. **Patient Portal**: Allow patients to join and control modes
6. **Mobile Optimization**: Native mobile app support for mode switching
7. **Call Recording**: Record audio/video with mode change timestamps
8. **Group Calls**: Mode switching in multi-participant consultations

### **Advanced Options**

- **Video Quality Selection**: 360p, 480p, 720p, 1080p
- **Audio-Only with Screen Share**: Share screens in audio-only mode
- **Picture-in-Picture**: Float video while using other apps
- **Virtual Backgrounds**: Blur/replace background in video mode

---

## 📝 Best Practices

### **For Doctors**

1. ✅ **Start with Video**: Begin consultations with video for better rapport
2. ✅ **Ask Before Switching**: Inform patient before requesting mode change
3. ✅ **Test Audio Quality**: Ensure clear audio before switching from video
4. ✅ **Use Audio for Records Review**: Switch to audio when focusing on charts
5. ✅ **Respect Privacy**: Honor patient's preference for audio-only

### **For Patients**

1. ✅ **Choose Comfort**: Select audio-only if uncomfortable with video
2. ✅ **Check Environment**: Ensure quiet space for audio calls
3. ✅ **Use Headphones**: Better audio quality, reduced echo
4. ✅ **Stable Connection**: Test internet before scheduling video call
5. ✅ **Communicate Issues**: Tell doctor if video/audio isn't working

### **For System Administrators**

1. ✅ **Monitor Bandwidth**: Track usage patterns by mode
2. ✅ **Provide Guidelines**: Train staff on when to use each mode
3. ✅ **Test Regularly**: Verify mode switching works across devices
4. ✅ **Update Documentation**: Keep staff informed of features
5. ✅ **Collect Feedback**: Ask users about mode switching experience

---

## 🎓 Training Guide

### **Staff Training Checklist**

- [ ] Understand difference between call modes
- [ ] Practice scheduling video and audio consultations
- [ ] Test mode switching in demo calls
- [ ] Learn troubleshooting steps
- [ ] Understand permission flow
- [ ] Know when to recommend each mode
- [ ] Can explain feature to patients

### **Patient Education**

Provide patients with:
- Simple flyer explaining mode options
- Video tutorial on joining calls
- FAQ about switching modes
- Privacy assurance about mode control
- Contact info for technical support

---

## 🔗 Related Features

- **Telemedicine Module**: Schedule and manage virtual consultations
- **WebRTC Video Calling**: Full video/audio conferencing
- **Screen Sharing**: Share medical records during video calls
- **Call Duration Tracking**: Automatic logging of actual call time
- **Audit Logging**: All mode switches logged for compliance

---

## 📞 Support

**Technical Issues:**
- Check browser console for WebRTC errors
- Verify camera/microphone permissions
- Test with different browsers (Chrome, Edge, Firefox)
- Review network firewall settings (STUN/TURN access)

**Questions:**
- Contact IT support: support@carelink.com
- Developer: David Gabion Selorm (gabiondavidselorm@gmail.com)
- Documentation: TELEMEDICINE_VIDEO_GUIDE.md

---

## ✅ Summary

CareLink's audio/video mode switching provides:

- ✅ **Flexibility**: Switch between video and audio during calls
- ✅ **Permission-Based**: Both parties control mode changes
- ✅ **Better Privacy**: Easy switch to audio-only anytime
- ✅ **Bandwidth Optimization**: Save data with audio mode
- ✅ **Seamless Experience**: No call interruption during switch
- ✅ **Professional Quality**: HD video, echo-cancelled audio

**Ready to execute the database update in Supabase to enable this feature!**
