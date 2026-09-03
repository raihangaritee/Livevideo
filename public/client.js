// Client-side JavaScript
let socket;
let currentUser;
let currentCallRoom = null;
let callTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!token) {
        window.location.href = '/login';
        return;
    }

    currentUser = user;
    
    // Initialize socket
    socket = io();
    
    // Authenticate socket
    socket.emit('authenticate', token);
    
    // Update UI
    updateUserInfo();
    
    // Attach event listeners
    attachEventListeners();
    
    // Join global chat
    socket.emit('join-chat', { roomId: 'global' });
});

function updateUserInfo() {
    document.getElementById('user-name').textContent = currentUser.name || currentUser.email;
    document.getElementById('user-rewards').textContent = `Rewards: ${currentUser.totalRewards || 0}`;
    document.getElementById('calls-remaining').textContent = `Calls Remaining: ${currentUser.callsRemaining || 0}`;
}

function attachEventListeners() {
    // Start Call
    document.getElementById('start-call-btn').addEventListener('click', startCall);
    
    // End Call
    document.getElementById('end-call-btn').addEventListener('click', endCall);
    
    // Send Message
    document.getElementById('send-message-btn').addEventListener('click', sendMessage);
    document.getElementById('message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Logout
    document.getElementById('logout-btn').addEventListener('click', logout);
    
    // Socket events
    socket.on('call-started', handleCallStarted);
    socket.on('call-ended', handleCallEnded);
    socket.on('call-error', handleCallError);
    socket.on('new-message', handleNewMessage);
    socket.on('chat-joined', handleChatJoined);
    socket.on('user-joined-chat', handleUserJoined);
    socket.on('user-left-chat', handleUserLeft);
    socket.on('chat-error', handleChatError);
}

function startCall() {
    socket.emit('start-call', {});
}

function endCall() {
    if (currentCallRoom) {
        socket.emit('end-call', { roomId: currentCallRoom });
    }
}

function sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    
    if (text) {
        socket.emit('send-message', {
            roomId: 'global',
            text: text
        });
        input.value = '';
    }
}

function handleCallStarted(data) {
    currentCallRoom = data.roomId;
    
    // Update UI
    document.getElementById('start-call-btn').disabled = true;
    document.getElementById('end-call-btn').disabled = false;
    
    // Play video
    const video = document.getElementById('call-video');
    video.src = data.video.path;
    video.play();
    
    // Update calls remaining
    currentUser.callsRemaining = data.callsRemaining;
    currentUser.totalRewards = (currentUser.totalRewards || 0) + data.reward;
    updateUserInfo();
    
    // Start timer
    let seconds = 0;
    callTimer = setInterval(() => {
        seconds++;
        document.getElementById('call-timer').textContent = `Time: ${seconds}s`;
    }, 1000);
    
    // Show reward notification
    showNotification(`You earned ${data.reward} points!`);
}

function handleCallEnded(data) {
    currentCallRoom = null;
    
    // Update UI
    document.getElementById('start-call-btn').disabled = false;
    document.getElementById('end-call-btn').disabled = true;
    document.getElementById('call-timer').textContent = '';
    
    // Stop video
    const video = document.getElementById('call-video');
    video.pause();
    video.src = '';
    
    // Clear timer
    if (callTimer) {
        clearInterval(callTimer);
        callTimer = null;
    }
    
    if (data.reward) {
        showNotification(`Call ended! You earned ${data.reward} points!`);
    }
}

function handleCallError(error) {
    alert(error.message);
}

function handleNewMessage(message) {
    const messagesContainer = document.getElementById('chat-messages');
    const messageElement = document.createElement('div');
    messageElement.className = 'message';
    
    const time = new Date(message.timestamp).toLocaleTimeString();
    
    messageElement.innerHTML = `
        <div class="user">${message.email}</div>
        <div class="time">${time}</div>
        <div class="text">${message.text}</div>
    `;
    
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function handleChatJoined(data) {
    console.log('Joined chat:', data.roomId);
}

function handleUserJoined(data) {
    showNotification(`${data.email} joined the chat`);
}

function handleUserLeft(data) {
    showNotification(`${data.email} left the chat`);
}

function handleChatError(error) {
    console.error('Chat error:', error.message);
}

function showNotification(message) {
    if (Notification.permission === 'granted') {
        new Notification('Video Reward App', { body: message });
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                new Notification('Video Reward App', { body: message });
            }
        });
    }
    
    // Also show in console
    console.log(message);
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
}

// Request notification permission on load
if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
    Notification.requestPermission();
}
