/**
 * Room Manager
 * Manages multiple drawing rooms and their states
 */

const DrawingState = require('./drawing-state');

class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomId -> Room object
  }

  /**
   * Get or create a room
   * @param {string} roomId - Room identifier
   * @returns {Object} Room object
   */
  getRoom(roomId) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        id: roomId,
        users: new Map(), // userId -> user object
        drawingState: new DrawingState(),
        createdAt: Date.now()
      });
    }
    return this.rooms.get(roomId);
  }

  /**
   * Add user to a room
   * @param {string} roomId - Room identifier
   * @param {string} userId - User identifier
   * @param {Object} ws - WebSocket connection
   * @param {Object} userData - User data (name, color, etc.)
   * @returns {Object} User object
   */
  addUser(roomId, userId, ws, userData) {
    const room = this.getRoom(roomId);
    
    const user = {
      id: userId,
      ws: ws,
      name: userData.name || `User ${room.users.size + 1}`,
      color: userData.color || this.generateUserColor(room.users.size),
      joinedAt: Date.now(),
      cursor: { x: 0, y: 0 }
    };
    
    room.users.set(userId, user);
    return user;
  }

  /**
   * Remove user from a room
   * @param {string} roomId - Room identifier
   * @param {string} userId - User identifier
   */
  removeUser(roomId, userId) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.users.delete(userId);
      
      // Clean up empty rooms after 5 minutes
      if (room.users.size === 0) {
        setTimeout(() => {
          const currentRoom = this.rooms.get(roomId);
          if (currentRoom && currentRoom.users.size === 0) {
            this.rooms.delete(roomId);
          }
        }, 5 * 60 * 1000);
      }
    }
  }

  /**
   * Get all users in a room
   * @param {string} roomId - Room identifier
   * @returns {Array} Array of user objects (without ws)
   */
  getRoomUsers(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    
    return Array.from(room.users.values()).map(user => ({
      id: user.id,
      name: user.name,
      color: user.color,
      cursor: user.cursor
    }));
  }

  /**
   * Update user cursor position
   * @param {string} roomId - Room identifier
   * @param {string} userId - User identifier
   * @param {Object} cursor - Cursor position {x, y}
   */
  updateUserCursor(roomId, userId, cursor) {
    const room = this.rooms.get(roomId);
    if (room && room.users.has(userId)) {
      room.users.get(userId).cursor = cursor;
    }
  }

  /**
   * Broadcast message to all users in a room except sender
   * @param {string} roomId - Room identifier
   * @param {string} senderId - Sender user ID
   * @param {Object} message - Message to broadcast
   */
  broadcast(roomId, senderId, message) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    
    const messageStr = JSON.stringify(message);
    
    room.users.forEach((user, userId) => {
      if (userId !== senderId && user.ws.readyState === 1) { // 1 = OPEN
        user.ws.send(messageStr);
      }
    });
  }

  /**
   * Broadcast message to all users in a room including sender
   * @param {string} roomId - Room identifier
   * @param {Object} message - Message to broadcast
   */
  broadcastAll(roomId, message) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    
    const messageStr = JSON.stringify(message);
    
    room.users.forEach(user => {
      if (user.ws.readyState === 1) {
        user.ws.send(messageStr);
      }
    });
  }

  /**
   * Generate a color for a user based on their index
   * @param {number} index - User index
   * @returns {string} Hex color code
   */
  generateUserColor(index) {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
      '#F8B739', '#52B788', '#E63946', '#457B9D'
    ];
    return colors[index % colors.length];
  }

  /**
   * Get room statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      totalRooms: this.rooms.size,
      totalUsers: Array.from(this.rooms.values()).reduce(
        (sum, room) => sum + room.users.size, 0
      )
    };
  }
}

module.exports = RoomManager;
