/**
 * WebSocket Client Manager
 * Handles real-time communication with the server
 */

class WebSocketManager {
  constructor() {
    this.ws = null;
    this.userId = null;
    this.roomId = 'default';
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    
    // Event handlers
    this.onInit = null;
    this.onDraw = null;
    this.onCursor = null;
    this.onUndo = null;
    this.onRedo = null;
    this.onClear = null;
    this.onUserJoined = null;
    this.onUserLeft = null;
    this.onConnectionChange = null;
    
    // Throttling for cursor updates
    this.lastCursorSend = 0;
    this.cursorThrottle = 50; // ms
    
    // Batching for draw events
    this.drawBatch = [];
    this.drawBatchTimeout = null;
    this.drawBatchDelay = 16; // ~60fps
  }

  /**
   * Connect to WebSocket server
   * @param {string} url - WebSocket server URL
   */
  connect(url) {
    try {
      this.ws = new WebSocket(url);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        
        if (this.onConnectionChange) {
          this.onConnectionChange('connected');
        }
        
        // Join room
        this.send({
          type: 'join',
          userId: this.userId,
          roomId: this.roomId,
          name: this.generateUserName()
        });
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };
      
      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        
        if (this.onConnectionChange) {
          this.onConnectionChange('disconnected');
        }
        
        // Attempt reconnection
        this.attemptReconnect(url);
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      this.attemptReconnect(url);
    }
  }

  /**
   * Attempt to reconnect to server
   * @param {string} url - WebSocket server URL
   */
  attemptReconnect(url) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect(url);
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      if (this.onConnectionChange) {
        this.onConnectionChange('failed');
      }
    }
  }

  /**
   * Handle incoming messages
   * @param {Object} data - Message data
   */
  handleMessage(data) {
    switch (data.type) {
      case 'init':
        this.userId = data.userId;
        if (this.onInit) {
          this.onInit(data);
        }
        break;
        
      case 'draw':
        if (this.onDraw) {
          this.onDraw(data.operation);
        }
        break;
        
      case 'cursor':
        if (this.onCursor) {
          this.onCursor(data.userId, data.cursor);
        }
        break;
        
      case 'undo':
        if (this.onUndo) {
          this.onUndo(data);
        }
        break;
        
      case 'redo':
        if (this.onRedo) {
          this.onRedo(data);
        }
        break;
        
      case 'clear':
        if (this.onClear) {
          this.onClear();
        }
        break;
        
      case 'user_joined':
        if (this.onUserJoined) {
          this.onUserJoined(data.user, data.users);
        }
        break;
        
      case 'user_left':
        if (this.onUserLeft) {
          this.onUserLeft(data.userId, data.users);
        }
        break;
        
      case 'error':
        console.error('Server error:', data.message);
        break;
        
      default:
        console.log('Unknown message type:', data.type);
    }
  }

  /**
   * Send message to server
   * @param {Object} data - Message data
   */
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket not connected, message not sent:', data);
    }
  }

  /**
   * Send drawing data
   * @param {Object} strokeData - Stroke data
   */
  sendDraw(strokeData) {
    this.send({
      type: 'draw',
      data: strokeData
    });
  }

  /**
   * Send cursor position (throttled)
   * @param {Object} cursor - Cursor position {x, y}
   */
  sendCursor(cursor) {
    const now = Date.now();
    
    if (now - this.lastCursorSend >= this.cursorThrottle) {
      this.send({
        type: 'cursor',
        cursor: cursor
      });
      this.lastCursorSend = now;
    }
  }

  /**
   * Send undo request
   */
  sendUndo() {
    this.send({
      type: 'undo'
    });
  }

  /**
   * Send redo request
   */
  sendRedo() {
    this.send({
      type: 'redo'
    });
  }

  /**
   * Send clear canvas request
   */
  sendClear() {
    this.send({
      type: 'clear'
    });
  }

  /**
   * Generate a random user name
   * @returns {string} User name
   */
  generateUserName() {
    const adjectives = ['Happy', 'Creative', 'Artistic', 'Bright', 'Clever', 'Swift', 'Bold', 'Calm'];
    const nouns = ['Painter', 'Artist', 'Drawer', 'Creator', 'Designer', 'Sketcher', 'Illustrator'];
    
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    
    return `${adj} ${noun}`;
  }

  /**
   * Close WebSocket connection
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Check if connected
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}
