import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'react-toastify'

/**
 * Notification Center Component
 * Displays in-app notifications with dropdown panel
 * Author: David Gabion Selorm
 */

const NotificationCenter = () => {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showPanel, setShowPanel] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      fetchNotifications()
      
      // Subscribe to real-time notifications
      const subscription = supabase
        .channel('notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            setNotifications(prev => [payload.new, ...prev])
            setUnreadCount(prev => prev + 1)
            
            // Show toast for high priority notifications
            if (payload.new.priority === 'urgent' || payload.new.priority === 'high') {
              toast.info(payload.new.title, {
                autoClose: 5000
              })
            }
          }
        )
        .subscribe()

      return () => {
        subscription.unsubscribe()
      }
    }
  }, [user])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('channel', 'in_app')
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error

      setNotifications(data || [])
      setUnreadCount(data?.filter(n => n.status === 'unread').length || 0)
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ status: 'read', read_at: new Date().toISOString() })
        .eq('id', notificationId)

      if (error) throw error

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, status: 'read' } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ status: 'read', read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('status', 'unread')

      if (error) throw error

      setNotifications(prev =>
        prev.map(n => ({ ...n, status: 'read' }))
      )
      setUnreadCount(0)
      toast.success('All notifications marked as read')
    } catch (error) {
      console.error('Error marking all as read:', error)
      toast.error('Failed to mark notifications as read')
    }
  }

  const deleteNotification = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)

      if (error) throw error

      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      toast.success('Notification deleted')
    } catch (error) {
      console.error('Error deleting notification:', error)
      toast.error('Failed to delete notification')
    }
  }

  const getNotificationIcon = (type) => {
    const icons = {
      appointment_reminder: '📅',
      lab_result: '🔬',
      prescription_ready: '💊',
      low_stock_alert: '⚠️',
      pending_claim: '📋',
      urgent_referral: '🔄',
      shift_handover: '🔔',
      new_prescription: '📝'
    }
    return icons[type] || '🔔'
  }

  const getPriorityColor = (priority) => {
    const colors = {
      urgent: 'bg-red-100 border-red-300',
      high: 'bg-orange-100 border-orange-300',
      normal: 'bg-blue-50 border-blue-200',
      low: 'bg-gray-50 border-gray-200'
    }
    return colors[priority] || colors.normal
  }

  const getTimeAgo = (timestamp) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffInSeconds = Math.floor((now - time) / 1000)

    if (diffInSeconds < 60) return 'Just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
    return time.toLocaleDateString()
  }

  return (
    <div className="relative">
      {/* Bell Icon */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="relative flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-slate-300 bg-white text-slate-600 shadow-md transition hover:border-slate-400 hover:bg-slate-50 active:scale-95"
      >
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        
        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute right-0 top-0 flex h-6 w-6 translate-x-1/4 -translate-y-1/4 items-center justify-center rounded-full bg-red-500 text-xs font-extrabold text-white shadow-lg">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {showPanel && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setShowPanel(false)}
          ></div>

          {/* Panel */}
          <div className="absolute right-0 z-40 mt-3 flex max-h-[80vh] w-96 max-w-[90vw] flex-col overflow-hidden rounded-3xl border-2 border-slate-300 bg-white shadow-[0_28px_65px_rgba(15,23,42,0.2)]">
            {/* Header */}
            <div className="flex items-center justify-between border-b-2 border-blue-300 bg-gradient-to-r from-[#2f74c7] to-[#2b66b8] p-5 text-white">
              <h3 className="font-extrabold text-xl">Notifications</h3>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm font-bold bg-blue-500 hover:bg-blue-400 px-3 py-1.5 rounded-lg transition active:scale-95"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setShowPanel(false)}
                  className="text-white hover:bg-blue-500 rounded-lg p-1.5 transition active:scale-95 font-bold text-lg"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-10 text-center text-gray-600">
                  <div className="spinner mx-auto mb-3"></div>
                  <p className="font-semibold text-base">Loading notifications...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-14 text-center text-gray-600">
                  <div className="text-6xl mb-4">🔔</div>
                  <p className="font-extrabold text-lg">No notifications yet</p>
                  <p className="text-base mt-2 font-semibold">You're all caught up!</p>
                </div>
              ) : (
                <div className="divide-y-2 divide-gray-100">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-5 hover:bg-gray-50 transition cursor-pointer border-l-4 ${
                        notification.status === 'unread' ? 
                        getPriorityColor(notification.priority) : 
                        'bg-white border-gray-200'
                      }`}
                      onClick={() => {
                        if (notification.status === 'unread') {
                          markAsRead(notification.id)
                        }
                        if (notification.link) {
                          window.location.href = notification.link
                        }
                      }}
                    >
                      <div className="flex items-start gap-4">
                        <div className="text-3xl flex-shrink-0">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className={`font-bold text-base ${
                              notification.status === 'unread' ? 'text-gray-900' : 'text-gray-600'
                            }`}>
                              {notification.title}
                            </h4>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteNotification(notification.id)
                              }}
                              className="text-gray-400 hover:text-red-600 text-sm font-bold"
                            >
                              ✕
                            </button>
                          </div>
                          <p className="text-base font-semibold text-gray-700 mt-2 line-clamp-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-3 mt-3">
                            <span className="text-sm font-bold text-gray-600">
                              {getTimeAgo(notification.created_at)}
                            </span>
                            {notification.status === 'unread' && (
                              <span className="text-sm font-extrabold bg-blue-500 text-white px-2.5 py-1 rounded-full">
                                New
                              </span>
                            )}
                            {notification.priority === 'urgent' && (
                              <span className="text-sm font-extrabold bg-red-500 text-white px-2.5 py-1 rounded-full">
                                Urgent
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-gray-200 text-center">
                <button
                  onClick={fetchNotifications}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Refresh
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default NotificationCenter
