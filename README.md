# 🎨 Real-Time Collaborative Drawing Canvas

A multi-user drawing application where multiple people can draw simultaneously on the same canvas with real-time synchronization using WebSockets.

DEMO LINK:- http://flam-production.up.railway.app
## ✨ Features

### Core Features
- **Real-time Drawing Synchronization**: See other users' drawings as they draw, not after they finish
- **Multiple Drawing Tools**: Brush and eraser with adjustable stroke width
- **Color Picker**: Full color palette with quick-access presets
- **Global Undo/Redo**: Works across all users with proper conflict resolution
- **User Management**: See who's online with color-coded user indicators
- **Cursor Tracking**: View real-time cursor positions of other users
- **Touch Support**: Works on mobile devices and tablets
- **Keyboard Shortcuts**: Quick access to common actions

### Technical Highlights
- **Vanilla JavaScript**: No frontend frameworks - pure DOM/Canvas manipulation
- **Native WebSockets**: Real-time bidirectional communication
- **Efficient Canvas Operations**: Optimized path rendering and redrawing
- **State Synchronization**: Server-authoritative drawing state management
- **Automatic Reconnection**: Handles network interruptions gracefully

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

```bash
# Clone or download the repository
cd collaborative-canvas

# Install dependencies
npm install

# Start the server
npm start
```

The application will be available at `http://localhost:3000`

### Testing with Multiple Users

1. Open `http://localhost:3000` in your browser
2. Open the same URL in another browser window/tab or different device on the same network
3. Start drawing in one window and watch it appear in real-time in the other

**Tip**: Use different browsers or incognito windows to simulate multiple users on the same machine.

## 🎮 Usage

### Drawing Tools
- **Brush (B)**: Draw freehand strokes
- **Eraser (E)**: Erase parts of the canvas

### Controls
- **Color Picker**: Click to choose any color, or use preset colors
- **Stroke Width**: Adjust the thickness of your brush/eraser (1-50px)
- **Undo (Ctrl/Cmd+Z)**: Undo the last drawing operation (global)
- **Redo (Ctrl/Cmd+Y)**: Redo the last undone operation (global)
- **Clear**: Clear the entire canvas (affects all users)

### Keyboard Shortcuts
- `B` - Switch to Brush tool
- `E` - Switch to Eraser tool
- `Ctrl/Cmd + Z` - Undo
- `Ctrl/Cmd + Y` or `Ctrl/Cmd + Shift + Z` - Redo

## 🏗️ Architecture

### Project Structure
```
collaborative-canvas/
├── client/                 # Frontend files
│   ├── index.html         # Main HTML structure
│   ├── style.css          # Styling and layout
│   ├── canvas.js          # Canvas drawing logic
│   ├── websocket.js       # WebSocket client manager
│   └── main.js            # Application initialization
├── server/                # Backend files
│   ├── server.js          # Express + WebSocket server
│   ├── rooms.js           # Room management
│   └── drawing-state.js   # Drawing state management
├── package.json
├── README.md
└── ARCHITECTURE.md        # Detailed architecture documentation
```

### Technology Stack
- **Frontend**: HTML5 Canvas API, Vanilla JavaScript, CSS3
- **Backend**: Node.js, Express, WebSocket (ws library)
- **Communication**: WebSocket protocol for real-time bidirectional communication

## 🔧 Configuration

### Environment Variables
- `PORT` - Server port (default: 3000)

### Server Configuration
Edit `server/server.js` to modify:
- WebSocket configuration
- Room settings
- Connection limits

## 🎯 Key Features Explained

### Real-Time Synchronization
Drawing operations are transmitted as they happen, not after completion. This provides a smooth collaborative experience where you can see others drawing stroke-by-stroke.

### Global Undo/Redo
Unlike typical drawing apps where undo only affects your own actions, this implementation maintains a global operation history. When any user performs an undo, it removes the last operation from the shared canvas, regardless of who drew it.

**Conflict Resolution Strategy**:
- Server maintains authoritative operation history
- Undo/redo operations are broadcast to all clients
- Canvas is redrawn from the updated operation list
- Ensures all clients stay in sync

### Cursor Tracking
Each user's cursor position is tracked and displayed to other users with:
- Color-coded cursor dots matching user colors
- User name labels
- Smooth position interpolation

### Performance Optimizations
- **Throttled Cursor Updates**: Cursor positions sent at max 20 updates/second
- **Efficient Canvas Rendering**: Uses path optimization for smooth drawing
- **Minimal Redraws**: Only redraws affected areas when possible
- **Connection Pooling**: Efficient WebSocket connection management

## 🐛 Known Limitations

1. **Canvas Persistence**: Drawings are not saved to disk - they're lost when the server restarts
2. **Scalability**: Current implementation is optimized for small groups (2-10 users)
3. **History Limit**: Operation history is capped at 1000 operations to prevent memory issues
4. **No Authentication**: Users are identified by auto-generated IDs only
5. **Single Room**: Default implementation uses one shared room (can be extended)

## 🔮 Future Enhancements

- [ ] Canvas persistence (save/load from database)
- [ ] Multiple room support with room codes
- [ ] Additional drawing tools (rectangle, circle, line, text)
- [ ] Layer support
- [ ] Export canvas as image
- [ ] User authentication
- [ ] Drawing permissions (read-only users)
- [ ] Performance metrics dashboard
- [ ] Mobile app version

## 🧪 Testing

### Manual Testing Checklist
- [ ] Multiple users can draw simultaneously
- [ ] Drawings appear in real-time on all clients
- [ ] Undo/redo works correctly across users
- [ ] Cursor positions are visible and accurate
- [ ] Clear canvas affects all users
- [ ] Reconnection works after network interruption
- [ ] Touch drawing works on mobile devices
- [ ] Keyboard shortcuts function properly

### Load Testing
To test with multiple users, you can use browser automation tools or simply open multiple browser windows.

## 📝 Development Notes

### Time Spent
Approximately 4-5 hours for core implementation:
- Server architecture: 1 hour
- Canvas implementation: 1.5 hours
- WebSocket integration: 1 hour
- UI/UX polish: 1 hour
- Documentation: 0.5 hours

### Design Decisions
See `ARCHITECTURE.md` for detailed explanations of architectural choices and trade-offs.

## 🤝 Contributing

This is a demonstration project. Feel free to fork and extend it for your own use cases.

## 📄 License

MIT License - feel free to use this code for learning or commercial projects.

## 🙏 Acknowledgments

Built as a technical assessment to demonstrate:
- Canvas API mastery
- Real-time architecture design
- WebSocket implementation
- State synchronization strategies
- Clean code practices

---

**Note**: This is a demonstration project showcasing real-time collaborative features. For production use, consider adding authentication, data persistence, and additional security measures.
