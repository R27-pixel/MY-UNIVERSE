import { useNotificationStore } from '../../stores/notificationStore';
import { useExperienceStore } from '../../stores/experienceStore';
import { callService } from '../../services/callService';
import './NotificationToast.css';

export function NotificationToast() {
  const notifications = useNotificationStore((s) => s.notifications);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const removeNotification = useNotificationStore((s) => s.removeNotification);
  const setPhase = useExperienceStore((s) => s.setPhase);

  const unreadToasts = notifications.filter((n) => !n.read).slice(0, 3);

  if (unreadToasts.length === 0) return null;

  return (
    <div className="notif-container">
      {unreadToasts.map((n) => (
        <div key={n.id} className={`notif-toast notif-toast--${n.type}`}>
          <div className="notif-toast__header">
            <div className="notif-toast__type-tag">
              {n.type === 'call' ? '📞 CALL' : n.type === 'message' ? '💬 MESSAGE' : '✦ SYSTEM'}
            </div>
            <button
              type="button"
              className="notif-toast__close"
              onClick={() => markAsRead(n.id)}
              aria-label="Close notification"
            >
              ✕
            </button>
          </div>

          <div className="notif-toast__body">
            <div className="notif-toast__avatar">
              <span>{(n.callerName || n.title || 'U').charAt(0).toUpperCase()}</span>
            </div>

            <div className="notif-toast__content">
              <h4 className="notif-toast__title">{n.title}</h4>
              <p className="notif-toast__text">{n.body}</p>
              <span className="notif-toast__time">{n.timestamp}</span>
            </div>
          </div>

          <div className="notif-toast__actions">
            {n.type === 'message' && (
              <button
                type="button"
                className="notif-toast__btn notif-toast__btn--primary"
                onClick={() => {
                  markAsRead(n.id);
                  setPhase('CHAT');
                }}
              >
                Open Chat 💬
              </button>
            )}

            {n.type === 'call' && n.callerId && (
              <>
                <button
                  type="button"
                  className="notif-toast__btn notif-toast__btn--decline"
                  onClick={() => {
                    markAsRead(n.id);
                    removeNotification(n.id);
                    callService.declineCall();
                  }}
                >
                  Decline ✖
                </button>
                <button
                  type="button"
                  className="notif-toast__btn notif-toast__btn--accept"
                  onClick={() => {
                    markAsRead(n.id);
                    removeNotification(n.id);
                    callService.acceptCall();
                  }}
                >
                  Answer 📞
                </button>
              </>
            )}

            {n.type === 'call' && !n.callerId && (
              <button
                type="button"
                className="notif-toast__btn notif-toast__btn--primary"
                onClick={() => {
                  markAsRead(n.id);
                  setPhase('CHAT');
                }}
              >
                Return to Chat 💬
              </button>
            )}

            <button
              type="button"
              className="notif-toast__btn notif-toast__btn--secondary"
              onClick={() => removeNotification(n.id)}
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
