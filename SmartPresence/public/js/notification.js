// notification.js
document.addEventListener('DOMContentLoaded', () => {
    const notificationList = document.getElementById('notificationList');
    const markAllReadBtn = document.querySelector('.mark-all-read');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const notificationCount = document.querySelector('.notification-count');
    
    // Get user role from localStorage or default to 'student'
    const userRole = localStorage.getItem('userRole') || 'student';
    
    // Initialize empty notifications array
    let notifications = [];

    // Render notifications
    function renderNotifications(filter = 'all') {
        // Filter by role first
        let filteredNotifications = notifications.filter(
            notification => notification.role === userRole || notification.role === 'all'
        );
        
        // Then apply the selected filter
        if (filter === 'unread') {
            filteredNotifications = filteredNotifications.filter(n => !n.read);
        } else if (filter === 'read') {
            filteredNotifications = filteredNotifications.filter(n => n.read);
        }

        if (filteredNotifications.length === 0) {
            notificationList.innerHTML = `
                <div class="empty-state">
                    <i class="far fa-bell-slash"></i>
                    <h3>No notifications found</h3>
                    <p>You don't have any ${filter === 'all' ? '' : filter} notifications</p>
                </div>
            `;
            return;
        }

        notificationList.innerHTML = filteredNotifications.map(notification => `
            <div class="notification-item ${!notification.read ? 'unread' : ''}" data-id="${notification.id}">
                <div class="notification-icon">
                    <i class="fas ${notification.icon || 'fa-bell'}"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-title">
                        ${notification.title}
                    </div>
                    <div class="notification-time">
                        <i class="far fa-clock"></i> ${notification.time}
                    </div>
                    <p class="notification-message">${notification.message}</p>
                    ${notification.actions ? `
                        <div class="notification-actions">
                            ${notification.actions.map(action => `
                                <button class="${action.type === 'primary' ? 'primary' : ''}">
                                    ${action.text}
                                </button>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('');

        updateUnreadCount();
        setupEventListeners();
    }

    // Update unread count
    function updateUnreadCount() {
        const unreadCount = notifications.filter(n => !n.read).length;
        notificationCount.textContent = unreadCount;
        notificationCount.style.display = unreadCount > 0 ? 'flex' : 'none';
        
        // Update filter buttons if needed (e.g., if all notifications are read, update the active filter)
        const activeFilter = document.querySelector('.filter-btn.active')?.textContent.trim().toLowerCase();
        if (activeFilter === 'unread' && unreadCount === 0) {
            // If no unread notifications and we're on the unread filter, switch to 'all'
            const allFilterBtn = Array.from(filterButtons).find(btn => 
                btn.textContent.trim().toLowerCase() === 'all'
            );
            if (allFilterBtn) {
                filterButtons.forEach(btn => btn.classList.remove('active'));
                allFilterBtn.classList.add('active');
                renderNotifications('all');
            }
        }
    }

    // Mark all as read
    function markAllAsRead() {
        const activeFilter = document.querySelector('.filter-btn.active').textContent.trim().toLowerCase();
        
        // Only mark visible notifications as read based on the current filter
        if (activeFilter === 'all') {
            notifications = notifications.map(n => ({ ...n, read: true }));
        } else if (activeFilter === 'unread') {
            notifications = notifications.map(n => n.read ? n : { ...n, read: true });
        } else if (activeFilter === 'read') {
            // If on 'read' filter, mark all as read (including unread ones not currently shown)
            notifications = notifications.map(n => ({ ...n, read: true }));
        }
        
        renderNotifications(activeFilter);
        updateUnreadCount();
        
        // Show a brief confirmation
        const originalText = markAllReadBtn.textContent;
        markAllReadBtn.textContent = 'Marked as read!';
        markAllReadBtn.style.backgroundColor = '#4CAF50';
        markAllReadBtn.style.borderColor = '#4CAF50';
        markAllReadBtn.style.color = 'white';
        
        setTimeout(() => {
            markAllReadBtn.textContent = originalText;
            markAllReadBtn.style.backgroundColor = '';
            markAllReadBtn.style.borderColor = '';
            markAllReadBtn.style.color = '';
        }, 2000);
    }

    // Mark as read when clicked
    function markAsRead(id) {
        notifications = notifications.map(n => 
            n.id === id ? { ...n, read: true } : n
        );
        updateUnreadCount();
        
        // Update the UI to reflect the read state
        const notificationItem = document.querySelector(`.notification-item[data-id="${id}"]`);
        if (notificationItem) {
            notificationItem.classList.remove('unread');
        }
    }
    
    // Function to add a new notification
    function addNotification(notification) {
        const newId = notifications.length > 0 ? Math.max(...notifications.map(n => n.id)) + 1 : 1;
        const newNotification = {
            id: newId,
            title: notification.title,
            message: notification.message,
            time: 'Just now',
            read: false,
            type: notification.type || 'system',
            role: notification.role || 'all',
            icon: notification.icon || 'fa-bell',
            actions: notification.actions || []
        };
        
        // Only add if it's for the current user's role or for all roles
        if (newNotification.role !== userRole && newNotification.role !== 'all') {
            return null;
        }
        
        notifications.unshift(newNotification);
        updateUnreadCount();
        
        // Get current active filter
        const activeFilter = document.querySelector('.filter-btn.active')?.textContent.trim().toLowerCase() || 'all';
        renderNotifications(activeFilter);
        
        return newNotification;
    }

    // Setup event listeners
    function setupEventListeners() {
        // Mark all as read
        markAllReadBtn.addEventListener('click', () => {
            markAllAsRead();
        });

        // Filter buttons
        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Remove active class from all buttons
                filterButtons.forEach(btn => btn.classList.remove('active'));
                // Add active class to clicked button
                button.classList.add('active');
                
                // Get the filter type from button text
                const filterType = button.textContent.trim().toLowerCase();
                // Render notifications with the selected filter
                renderNotifications(filterType);
            });
        });

        // Mark as read when notification is clicked
        notificationList.addEventListener('click', (e) => {
            const notificationItem = e.target.closest('.notification-item');
            if (notificationItem) {
                const notificationId = parseInt(notificationItem.dataset.id);
                markAsRead(notificationId);
                
                // If it was a button click, handle the action
                const actionBtn = e.target.closest('.notification-actions button');
                if (actionBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const action = actionBtn.textContent.trim();
                    handleAction(action, notificationId);
                }
            }
        });
    }

    // Handle notification actions
    function handleAction(action, notificationId) {
        const notification = notifications.find(n => n.id === notificationId);
        if (!notification) return;

        switch(action) {
            case 'View Assignment':
                alert(`Opening assignment for notification #${notificationId}`);
                break;
            case 'Dismiss':
                notifications = notifications.filter(n => n.id !== notificationId);
                renderNotifications(document.querySelector('.filter-btn.active').textContent.toLowerCase());
                break;
            case 'Join Class':
                alert(`Joining class for notification #${notificationId}`);
                break;
            case 'View Details':
                alert(`Showing details for notification #${notificationId}`);
                break;
        }
    }

    // Initial render
    renderNotifications();
    updateUnreadCount(); // Make sure counter is updated on initial load
});