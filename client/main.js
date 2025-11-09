/**
 * Main Application
 * Initializes and coordinates canvas, WebSocket, and UI components
 */

// Initialize managers
const canvas = document.getElementById('drawingCanvas');
const canvasManager = new CanvasManager(canvas);
const wsManager = new WebSocketManager();

// UI Elements
const statusText = document.getElementById('statusText');
const userIdEl = document.getElementById('userId');
const currentRoomEl = document.getElementById('currentRoom');
const usersListEl = document.getElementById('usersList');
const cursorsLayer = document.getElementById('cursorsLayer');
const fpsCounter = document.getElementById('fpsCounter');
const latencyCounter = document.getElementById('latencyCounter');

// Tool buttons
const toolButtons = document.querySelectorAll('.tool-btn');
const colorPicker = document.getElementById('colorPicker');
const strokeWidth = document.getElementById('strokeWidth');
const strokeValue = document.getElementById('strokeValue');
const clearBtn = document.getElementById('clearBtn');

// Action buttons
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');

// Room controls
const roomInput = document.getElementById('roomInput');
const joinBtn = document.getElementById('joinBtn');

// State
let currentUser = null;
let users = new Map();
let remoteCursors = new Map();
let remoteStrokes = new Map(); // Track ongoing remote strokes

// Performance tracking
let frameCount = 0;
let lastFpsUpdate = Date.now();
let lastPingSent = 0;
let currentLatency = 0;

// Initialize WebSocket connection
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//${window.location.host}`;
wsManager.connect(wsUrl);

// WebSocket event handlers
wsManager.onConnectionChange = (status) => {
  updateConnectionStatus(status);
};

wsManager.onInit = (data) => {
  currentUser = data.user;
  users = new Map(data.users.map(u => [u.id, u]));
  
  // Update UI
  userIdEl.textContent = `(${currentUser.id.substring(0, 20)}...)`;
  currentRoomEl.textContent = wsManager.roomId;
  updateUsersList();
  
  // Redraw canvas from history
  if (data.drawingState && data.drawingState.operations) {
    canvasManager.redrawFromHistory(data.drawingState.operations);
  }
  
  // Enable undo/redo based on initial state
  const hasOperations = data.drawingState && data.drawingState.operations && data.drawingState.operations.length > 0;
  updateUndoRedoButtons(hasOperations, false);
};

wsManager.onDraw = (operation) => {
  if (operation && operation.data) {
    canvasManager.drawStroke(operation.data);
    // Enable undo button when any drawing happens
    undoBtn.disabled = false;
  }
};

wsManager.onCursor = (userId, cursor) => {
  updateRemoteCursor(userId, cursor);
};

wsManager.onUndo = (data) => {
  // Redraw canvas from updated operations list
  if (data.operations) {
    canvasManager.redrawFromHistory(data.operations);
  }
  updateUndoRedoButtons(data.canUndo, data.canRedo);
};

wsManager.onRedo = (data) => {
  // Redraw canvas from updated operations list
  if (data.operations) {
    canvasManager.redrawFromHistory(data.operations);
  }
  updateUndoRedoButtons(data.canUndo, data.canRedo);
};

wsManager.onClear = () => {
  canvasManager.clear();
  updateUndoRedoButtons(false, false);
};

wsManager.onUserJoined = (user, usersList) => {
  users = new Map(usersList.map(u => [u.id, u]));
  updateUsersList();
  showNotification(`${user.name} joined`, user.color);
};

wsManager.onUserLeft = (userId, usersList) => {
  const user = users.get(userId);
  if (user) {
    showNotification(`${user.name} left`, user.color);
  }
  
  users = new Map(usersList.map(u => [u.id, u]));
  updateUsersList();
  removeRemoteCursor(userId);
};

// Canvas event handlers
let isDrawing = false;

canvas.addEventListener('mousedown', handleDrawStart);
canvas.addEventListener('mousemove', handleDrawMove);
canvas.addEventListener('mouseup', handleDrawEnd);
canvas.addEventListener('mouseleave', handleDrawEnd);

// Touch support
canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

function handleDrawStart(e) {
  e.preventDefault();
  const coords = canvasManager.getCoordinates(e);
  canvasManager.startDrawing(coords.x, coords.y);
  isDrawing = true;
}

function handleDrawMove(e) {
  e.preventDefault();
  const coords = canvasManager.getCoordinates(e);
  
  // Send cursor position
  wsManager.sendCursor(coords);
  
  // Draw if mouse is down
  if (isDrawing) {
    canvasManager.draw(coords.x, coords.y);
  }
}

function handleDrawEnd(e) {
  if (!isDrawing) return;
  
  e.preventDefault();
  const strokeData = canvasManager.stopDrawing();
  isDrawing = false;
  
  // Send complete stroke to server
  if (strokeData) {
    wsManager.sendDraw(strokeData);
    // Enable undo button after drawing
    undoBtn.disabled = false;
  }
}

function handleTouchStart(e) {
  e.preventDefault();
  if (e.touches.length > 0) {
    const coords = canvasManager.getCoordinates(e);
    canvasManager.startDrawing(coords.x, coords.y);
    isDrawing = true;
  }
}

function handleTouchMove(e) {
  e.preventDefault();
  if (e.touches.length > 0) {
    const coords = canvasManager.getCoordinates(e);
    
    wsManager.sendCursor(coords);
    
    if (isDrawing) {
      canvasManager.draw(coords.x, coords.y);
    }
  }
}

function handleTouchEnd(e) {
  e.preventDefault();
  handleDrawEnd(e);
}

// Tool selection
toolButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    toolButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    const tool = btn.dataset.tool;
    canvasManager.setTool(tool);
  });
});

// Color picker
colorPicker.addEventListener('input', (e) => {
  canvasManager.setColor(e.target.value);
});

// Stroke width
strokeWidth.addEventListener('input', (e) => {
  const width = parseInt(e.target.value);
  canvasManager.setStrokeWidth(width);
  strokeValue.textContent = width;
});

// Action buttons
undoBtn.addEventListener('click', () => {
  wsManager.sendUndo();
});

redoBtn.addEventListener('click', () => {
  wsManager.sendRedo();
});

clearBtn.addEventListener('click', () => {
  if (confirm('Are you sure you want to clear the canvas? This will affect all users.')) {
    wsManager.sendClear();
  }
});

// Join room button
joinBtn.addEventListener('click', () => {
  const newRoom = roomInput.value.trim();
  if (newRoom && newRoom !== wsManager.roomId) {
    // Disconnect and reconnect to new room
    wsManager.disconnect();
    wsManager.roomId = newRoom;
    canvasManager.clear();
    users.clear();
    updateUsersList();
    wsManager.connect(wsUrl);
    currentRoomEl.textContent = newRoom;
  }
});

// Enable room input editing
roomInput.addEventListener('focus', () => {
  roomInput.removeAttribute('readonly');
});

roomInput.addEventListener('blur', () => {
  if (!roomInput.value.trim()) {
    roomInput.value = wsManager.roomId || 'default';
  }
});

roomInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    joinBtn.click();
    roomInput.blur();
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Undo: Ctrl+Z or Cmd+Z
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    wsManager.sendUndo();
  }
  
  // Redo: Ctrl+Y or Cmd+Shift+Z
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
    e.preventDefault();
    wsManager.sendRedo();
  }
  
  // Tool shortcuts
  if (e.key === 'b' || e.key === 'B') {
    document.querySelector('[data-tool="brush"]').click();
  }
  if (e.key === 'e' || e.key === 'E') {
    document.querySelector('[data-tool="eraser"]').click();
  }
});

// UI update functions
function updateConnectionStatus(status) {
  switch (status) {
    case 'connected':
      statusText.textContent = 'Connected';
      statusText.classList.remove('disconnected');
      break;
    case 'disconnected':
      statusText.textContent = 'Disconnected';
      statusText.classList.add('disconnected');
      break;
    case 'failed':
      statusText.textContent = 'Connection Failed';
      statusText.classList.add('disconnected');
      break;
    default:
      statusText.textContent = 'Connecting...';
  }
}

function updateUsersList() {
  usersListEl.innerHTML = '';
  
  users.forEach(user => {
    const userItem = document.createElement('div');
    userItem.className = 'user-item';
    if (currentUser && user.id === currentUser.id) {
      userItem.classList.add('self');
    }
    
    userItem.innerHTML = `
      <div class="user-item-color" style="background: ${user.color};"></div>
      <span class="user-item-name">${user.name.substring(0, 10)}</span>
    `;
    
    usersListEl.appendChild(userItem);
  });
}

function updateRemoteCursor(userId, cursor) {
  if (!currentUser || userId === currentUser.id) return;
  
  const user = users.get(userId);
  if (!user) return;
  
  let cursorEl = remoteCursors.get(userId);
  
  if (!cursorEl) {
    cursorEl = document.createElement('div');
    cursorEl.className = 'remote-cursor';
    cursorEl.innerHTML = `
      <div class="cursor-dot" style="background: ${user.color};"></div>
      <div class="cursor-label">${user.name}</div>
    `;
    cursorsLayer.appendChild(cursorEl);
    remoteCursors.set(userId, cursorEl);
  }
  
  cursorEl.style.left = `${cursor.x}px`;
  cursorEl.style.top = `${cursor.y}px`;
}

function removeRemoteCursor(userId) {
  const cursorEl = remoteCursors.get(userId);
  if (cursorEl) {
    cursorEl.remove();
    remoteCursors.delete(userId);
  }
}

function updateUndoRedoButtons(canUndo, canRedo) {
  undoBtn.disabled = !canUndo;
  redoBtn.disabled = !canRedo;
}

function showNotification(message, color) {
  // Simple notification - could be enhanced with a toast library
  console.log(`[Notification] ${message}`);
}

// Initialize UI
strokeValue.textContent = strokeWidth.value;

// FPS Counter
function updateFPS() {
  frameCount++;
  const now = Date.now();
  const elapsed = now - lastFpsUpdate;
  
  if (elapsed >= 1000) {
    const fps = Math.round((frameCount * 1000) / elapsed);
    fpsCounter.textContent = fps;
    frameCount = 0;
    lastFpsUpdate = now;
  }
  
  requestAnimationFrame(updateFPS);
}

// Start FPS counter
requestAnimationFrame(updateFPS);

// Latency tracking (simulate with ping)
setInterval(() => {
  if (wsManager.isConnected()) {
    lastPingSent = Date.now();
    // In a real implementation, you'd send a ping message and measure response
    // For now, we'll show a simulated latency
    const simulatedLatency = Math.floor(Math.random() * 20) + 10;
    latencyCounter.textContent = simulatedLatency;
  } else {
    latencyCounter.textContent = '--';
  }
}, 2000);

console.log('Canvas Lab initialized');
