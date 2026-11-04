import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import OnboardingWizard from './OnboardingWizard'
import { command, query } from './api'
vi.mock('./api', () => ({ command:vi.fn(), query:vi.fn() }))
vi.mock('../supabaseClient', () => ({ supabase:{from:() => ({select:() => ({eq:() => ({maybeSingle:() => ({})})})})} }))
const hospital = {id:'hospital',hospital_name:'Pilot',owner_email:'admin@example.com',lifecycle_state:'onboarding'}
describe('onboarding drafts', () => {
  it('resumes a saved step and retains edits after a conflicting save', async () => {
    query.mockResolvedValue({revision:3,step:6,requirements:{training_notes:'Existing evidence'}})
    command.mockRejectedValue(new Error('Draft changed by another editor'))
    render(<MemoryRouter><OnboardingWizard hospital={hospital} editable /></MemoryRouter>)
    const notes = await screen.findByLabelText('Training completion, responsible person and evidence references')
    expect(notes.value).toBe('Existing evidence')
    fireEvent.change(notes,{target:{value:'Updated evidence'}})
    fireEvent.click(screen.getByRole('button',{name:'Save draft'}))
    await screen.findByRole('alert')
    expect(notes.value).toBe('Updated evidence')
    expect(command).toHaveBeenCalledWith('platform_save_onboarding_draft',expect.objectContaining({p_revision:3,p_step:6,p_requirements:{training_notes:'Updated evidence'}}))
    await waitFor(() => expect(screen.getByRole('button',{name:'Save draft'}).disabled).toBe(false))
  })
})
