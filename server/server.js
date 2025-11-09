/**
 * WebSocket Server for Collaborative Drawing Canvas
 * Handles real-time synchronization of drawing operations
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const RoomManager = require('./rooms');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const roomManager = new RoomManager();
const PORT = process.env.PORT || 3000;

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    stats: roomManager.getStats()
  });
});

// WebSocket connection handler
wss.on('connection', (ws) => {
  let userId = null;
  let roomId = 'default'; // Default room
  
  console.log('New WebSocket connection');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'join':
          handleJoin(ws, data);
          break;
          
        case 'draw':
          handleDraw(data);
          break;
          
        case 'cursor':
          handleCursor(data);
          break;
          
        case 'undo':
          handleUndo(data);
          break;
          
        case 'redo':
          handleRedo(data);
          break;
          
        case 'clear':
          handleClear(data);
          break;
          
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process message'
      }));
    }
  });

  ws.on('close', () => {
    if (userId && roomId) {
      console.log(`User ${userId} disconnected from room ${roomId}`);
      roomManager.removeUser(roomId, userId);
      
      // Notify other users
      roomManager.broadcast(roomId, userId, {
        type: 'user_left',
        userId: userId,
        users: roomManager.getRoomUsers(roomId)
      });
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  /**
   * Handle user join
   */
  function handleJoin(ws, data) {
    userId = data.userId || generateUserId();
    roomId = data.roomId || 'default';
    
    const user = roomManager.addUser(roomId, userId, ws, {
      name: data.name,
      color: data.color
    });
    
    const room = roomManager.getRoom(roomId);
    
    console.log(`User ${userId} joined room ${roomId}`);
    
    // Send initial state to the new user
    ws.send(JSON.stringify({
      type: 'init',
      userId: userId,
      user: {
        id: user.id,
        name: user.name,
        color: user.color
      },
      users: roomManager.getRoomUsers(roomId),
      drawingState: room.drawingState.getFullState()
    }));
    
    // Notify other users about the new user
    roomManager.broadcast(roomId, userId, {
      type: 'user_joined',
      user: {
        id: user.id,
        name: user.name,
        color: user.color
      },
      users: roomManager.getRoomUsers(roomId)
    });
  }

  /**
   * Handle drawing operation
   */
  function handleDraw(data) {
    const room = roomManager.getRoom(roomId);
    
    // Add operation to drawing state
    const operation = room.drawingState.addOperation({
      type: 'draw',
      userId: userId,
      data: data.data
    });
    
    // Broadcast to all other users
    roomManager.broadcast(roomId, userId, {
      type: 'draw',
      operation: operation
    });
  }

  /**
   * Handle cursor movement
   */
  function handleCursor(data) {
    roomManager.updateUserCursor(roomId, userId, data.cursor);
    
    // Broadcast cursor position to other users
    roomManager.broadcast(roomId, userId, {
      type: 'cursor',
      userId: userId,
      cursor: data.cursor
    });
  }

  /**
   * Handle undo operation
   */
  function handleUndo(data) {
    const room = roomManager.getRoom(roomId);
    const operation = room.drawingState.undo();
    
    if (operation) {
      // Broadcast undo to all users (including sender)
      roomManager.broadcastAll(roomId, {
        type: 'undo',
        operation: operation,
        operations: room.drawingState.getActiveOperations(),
        canUndo: room.drawingState.canUndo(),
        canRedo: room.drawingState.canRedo()
      });
    }
  }

  /**
   * Handle redo operation
   */
  function handleRedo(data) {
    const room = roomManager.getRoom(roomId);
    const operation = room.drawingState.redo();
    
    if (operation) {
      // Broadcast redo to all users (including sender)
      roomManager.broadcastAll(roomId, {
        type: 'redo',
        operation: operation,
        operations: room.drawingState.getActiveOperations(),
        canUndo: room.drawingState.canUndo(),
        canRedo: room.drawingState.canRedo()
      });
    }
  }

  /**
   * Handle clear canvas
   */
  function handleClear(data) {
    const room = roomManager.getRoom(roomId);
    room.drawingState.clear();
    
    // Broadcast clear to all users (including sender)
    roomManager.broadcastAll(roomId, {
      type: 'clear'
    });
  }
});

/**
 * Generate unique user ID
 */
function generateUserId() {
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket server ready`);
});
