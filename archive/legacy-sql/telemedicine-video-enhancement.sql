-- ============================================
-- CareLink HMS - Telemedicine Video Call Enhancement
-- Add built-in video call support with actual duration tracking
-- Author: David Gabion Selorm
-- Date: April 4, 2026
-- ============================================

-- Add actual_duration column to track real call duration
ALTER TABLE virtual_consultations 
ADD COLUMN IF NOT EXISTS actual_duration INTEGER;

-- Add call_mode column to track if call was video or audio-only
ALTER TABLE virtual_consultations 
ADD COLUMN IF NOT EXISTS call_mode TEXT DEFAULT 'video' CHECK (call_mode IN ('video', 'audio'));

-- Update meeting_platform to include carelink_video and carelink_audio options
ALTER TABLE virtual_consultations 
DROP CONSTRAINT IF EXISTS virtual_consultations_meeting_platform_check;

ALTER TABLE virtual_consultations 
ADD CONSTRAINT virtual_consultations_meeting_platform_check 
CHECK (meeting_platform IN ('carelink_video', 'carelink_audio', 'zoom', 'google_meet', 'microsoft_teams', 'custom'));

-- Add comments for clarity
COMMENT ON COLUMN virtual_consultations.actual_duration IS 'Actual call duration in minutes (tracked by WebRTC call)';
COMMENT ON COLUMN virtual_consultations.duration IS 'Scheduled/expected duration in minutes';
COMMENT ON COLUMN virtual_consultations.call_mode IS 'Call type: video (with camera) or audio (audio-only mode)';

-- Update default platform to carelink_video
ALTER TABLE virtual_consultations 
ALTER COLUMN meeting_platform SET DEFAULT 'carelink_video';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Telemedicine video/audio call enhancement applied successfully!';
  RAISE NOTICE '- Added actual_duration column';
  RAISE NOTICE '- Added call_mode column (video/audio)';
  RAISE NOTICE '- Updated meeting_platform to include carelink_video and carelink_audio';
  RAISE NOTICE '- Set default platform to carelink_video';
  RAISE NOTICE '- Users can now switch between video and audio modes with permission';
END $$;
