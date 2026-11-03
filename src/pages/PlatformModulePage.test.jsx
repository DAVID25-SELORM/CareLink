import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PlatformModulePage from './PlatformModulePage'
import { fetchAll } from '../platform/api'
vi.mock('../layouts/PlatformLayout', () => ({ default: ({ children }) => <div>{children}</div> }))
vi.mock('../platform/api', () => ({ fetchAll: vi.fn() }))
describe('platform module navigation', () => {
  it('finishes loading once and loads the new table when switching tabs', async () => {
    fetchAll.mockResolvedValue([{ id: 'one', name: 'Starter', code: 'starter', active: true }])
    const view = render(<PlatformModulePage module="plans" />)
    await screen.findByText('Starter')
    expect(fetchAll).toHaveBeenCalledTimes(1)
    view.rerender(<PlatformModulePage module="plans" />)
    expect(fetchAll).toHaveBeenCalledTimes(1)
    fetchAll.mockResolvedValue([{ id: 'settings', display_name: 'CareLink', renewal_notice_days: 14 }])
    view.rerender(<PlatformModulePage module="settings" />)
    await screen.findByText('CareLink')
    await waitFor(() => expect(fetchAll).toHaveBeenCalledTimes(2))
    expect(fetchAll).toHaveBeenLastCalledWith('platform_settings')
    expect(screen.queryByLabelText('Loading records')).toBeNull()
  })
})
