-- ============================================
-- CareLink HMS - Telemedicine Video Call Enhancement
-- Add built-in video call support columns
-- Author: David Gabion Selorm
-- Date: April 4, 2026
-- ============================================

-- Add actual_duration column to track real call duration
ALTER TABLE virtual_consultations 
ADD COLUMN IF NOT EXISTS actual_duration INTEGER;

-- Add carelink_video to meeting_platform check constraint
DO $$ 
BEGIN
  ALTER TABLE virtual_consultations 
  DROP CONSTRAINT IF EXISTS virtual_consultations_meeting_platform_check;
  
  ALTER TABLE virtual_consultations 
  ADD CONSTRAINT virtual_consultations_meeting_platform_check 
  CHECK (meeting_platform IN ('carelink_video', 'zoom', 'google_meet', 'microsoft_teams', 'custom'));
EXCEPTION
  WHEN others THEN
    -- If constraint doesn't exist, create it
    ALTER TABLE virtual_consultations 
    ADD CONSTRAINT virtual_consultations_meeting_platform_check 
    CHECK (meeting_platform IN ('carelink_video', 'zoom', 'google_meet', 'microsoft_teams', 'custom'));
END $$;

-- Add comment for documentation
COMMENT ON COLUMN virtual_consultations.actual_duration IS 'Actual call duration in minutes (tracked from WebRTC session)';
COMMENT ON COLUMN virtual_consultations.meeting_platform IS 'Video platform: carelink_video (built-in WebRTC), zoom, google_meet, microsoft_teams, or custom';
