# 🏗️ Architecture Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Data Flow](#data-flow)
3. [WebSocket Protocol](#websocket-protocol)
4. [Undo/Redo Strategy](#undoredo-strategy)
5. [Performance Decisions](#performance-decisions)
6. [Conflict Resolution](#conflict-resolution)
7. [State Management](#state-management)

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Canvas     │  │  WebSocket   │  │     UI       │      │
│  │   Manager    │◄─┤   Manager    │◄─┤  Controller  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │ WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       Server Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  WebSocket   │  │     Room     │  │   Drawing    │      │
│  │   Server     │─►│   Manager    │─►│    State     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

#### Client Components

**1. CanvasManager (`canvas.js`)**
- Handles all HTML5 Canvas operations
- Manages drawing tools (brush, eraser)
- Optimizes rendering performance
- Converts mouse/touch events to canvas coordinates
- Maintains current drawing state

**2. WebSocketManager (`websocket.js`)**
- Manages WebSocket connection lifecycle
- Handles automatic reconnection with exponential backoff
- Throttles cursor position updates
- Serializes/deserializes messages
- Provides event-based API for application layer

**3. Main Application (`main.js`)**
- Coordinates between Canvas and WebSocket managers
- Handles UI interactions
- Manages remote cursor rendering
- Updates user list and connection status
- Implements keyboard shortcuts

#### Server Components

**1. WebSocket Server (`server.js`)**
- Express HTTP server for static file serving
- WebSocket server for real-time communication
- Routes messages to appropriate handlers
- Manages user connections and disconnections

**2. RoomManager (`rooms.js`)**
- Manages multiple drawing rooms
- Tracks users in each room
- Handles user join/leave events
- Broadcasts messages to room participants
- Auto-cleanup of empty rooms

**3. DrawingState (`drawing-state.js`)**
- Maintains global operation history
- Implements undo/redo stack
- Provides state snapshots for new users
- Enforces operation history limits

---

## Data Flow

### Drawing Operation Flow

```
User draws on canvas
        │
        ▼
┌───────────────────┐
│  Mouse/Touch      │
│  Event Handler    │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  CanvasManager    │
│  - startDrawing() │
│  - draw()         │
│  - stopDrawing()  │
└───────────────────┘
        │
        ▼ (on stroke complete)
┌───────────────────┐
│  WebSocketManager │
│  - sendDraw()     │
└───────────────────┘
        │
        ▼ WebSocket Message
┌───────────────────┐
│  Server           │
│  - handleDraw()   │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  DrawingState     │
│  - addOperation() │
└───────────────────┘
        │
        ▼ Broadcast to all clients
┌───────────────────┐
│  Other Clients    │
│  - onDraw()       │
│  - drawStroke()   │
└───────────────────┘
```

### New User Join Flow

```
User connects
        │
        ▼
┌───────────────────┐
│  WebSocket        │
│  Connection       │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  Send 'join'      │
│  message          │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  Server           │
│  - handleJoin()   │
└───────────────────┘
        │
        ├─► Add to RoomManager
        │
        ├─► Send 'init' with:
        │   - User info
        │   - Current users
        │   - Drawing history
        │
        └─► Broadcast 'user_joined'
                    │
                    ▼
            ┌───────────────────┐
            │  New user redraws │
            │  canvas from      │
            │  history          │
            └───────────────────┘
```

---

## WebSocket Protocol

### Message Format

All messages follow this JSON structure:
```json
{
  "type": "message_type",
  "...": "additional fields"
}
```

### Message Types

#### Client → Server

**1. Join Room**
```json
{
  "type": "join",
  "userId": "user_123",
  "roomId": "default",
  "name": "Creative Painter"
}
```

**2. Drawing Operation**
```json
{
  "type": "draw",
  "data": {
    "tool": "brush",
    "color": "#FF0000",
    "width": 5,
    "points": [
      {"x": 100, "y": 150},
      {"x": 101, "y": 151},
      ...
    ]
  }
}
```

**3. Cursor Position**
```json
{
  "type": "cursor",
  "cursor": {
    "x": 250,
    "y": 300
  }
}
```

**4. Undo Request**
```json
{
  "type": "undo"
}
```

**5. Redo Request**
```json
{
  "type": "redo"
}
```

**6. Clear Canvas**
```json
{
  "type": "clear"
}
```

#### Server → Client

**1. Initialization**
```json
{
  "type": "init",
  "userId": "user_123",
  "user": {
    "id": "user_123",
    "name": "Creative Painter",
    "color": "#FF6B6B"
  },
  "users": [...],
  "drawingState": {
    "operations": [...],
    "currentIndex": 42
  }
}
```

**2. Drawing Operation**
```json
{
  "type": "draw",
  "operation": {
    "id": "op_1234567890_abc",
    "type": "draw",
    "userId": "user_456",
    "timestamp": 1234567890,
    "data": {...}
  }
}
```

**3. Cursor Update**
```json
{
  "type": "cursor",
  "userId": "user_456",
  "cursor": {"x": 250, "y": 300}
}
```

**4. Undo Result**
```json
{
  "type": "undo",
  "operation": {...},
  "operations": [...],
  "canUndo": true,
  "canRedo": true
}
```

**5. User Joined**
```json
{
  "type": "user_joined",
  "user": {...},
  "users": [...]
}
```

**6. User Left**
```json
{
  "type": "user_left",
  "userId": "user_456",
  "users": [...]
}
```

### Protocol Design Decisions

**Why complete strokes instead of individual points?**
- Reduces network traffic significantly
- Ensures stroke atomicity
- Simplifies undo/redo implementation
- Better for conflict resolution

**Why throttle cursor updates?**
- Cursor movements generate high-frequency events
- Throttling to 50ms (20 updates/sec) provides smooth tracking
- Reduces server load and network bandwidth

**Why server-authoritative state?**
- Single source of truth prevents desynchronization
- Simplifies conflict resolution
- Enables reliable undo/redo across clients

---

## Undo/Redo Strategy

### The Challenge

Global undo/redo in a collaborative environment is complex because:
1. Multiple users can draw simultaneously
2. Operations need a consistent global order
3. Undoing one user's action affects all users
4. Network latency can cause ordering issues

### Our Solution: Server-Authoritative History

```
┌─────────────────────────────────────────────────────────┐
│              Server Drawing State                        │
│                                                          │
│  operations: [op1, op2, op3, op4, op5, op6, op7]       │
│                                    ▲                     │
│  currentIndex: ──────────────────┘                      │
│                                                          │
│  Undo: currentIndex--                                   │
│  Redo: currentIndex++                                   │
└─────────────────────────────────────────────────────────┘
```

### Implementation Details

**Operation Structure**
```javascript
{
  id: "op_1234567890_abc",      // Unique operation ID
  type: "draw",                   // Operation type
  userId: "user_123",             // Who performed it
  timestamp: 1234567890,          // When it happened
  data: {                         // Operation-specific data
    tool: "brush",
    color: "#FF0000",
    width: 5,
    points: [...]
  }
}
```

**Undo Process**
1. Client sends undo request
2. Server decrements `currentIndex`
3. Server sends updated operation list to ALL clients
4. All clients redraw canvas from operation list
5. All clients update undo/redo button states

**Redo Process**
1. Client sends redo request
2. Server increments `currentIndex`
3. Server sends updated operation list to ALL clients
4. All clients redraw canvas from operation list
5. All clients update undo/redo button states

**Why Full Redraw?**
- Guarantees consistency across all clients
- Simpler than maintaining incremental state
- Canvas redraw is fast enough for typical use cases
- Avoids complex state reconciliation logic

### Conflict Resolution

**Scenario**: User A and User B draw simultaneously, then User A undoes

```
Timeline:
t1: User A draws (op1)
t2: User B draws (op2)
t3: User A undoes

Result:
- Server removes op2 (last operation)
- Both users see op1 only
- This is expected behavior for global undo
```

**Alternative Considered**: Per-user undo
- Would require tracking operation ownership
- Complex UI: "Undo my last action" vs "Undo last action"
- Decided against for simplicity and clarity

---

## Performance Decisions

### 1. Canvas Rendering Optimization

**Path Optimization**
```javascript
// Instead of drawing each point individually
ctx.beginPath();
ctx.moveTo(points[0].x, points[0].y);
for (let i = 1; i < points.length; i++) {
  ctx.lineTo(points[i].x, points[i].y);
}
ctx.stroke();
```

**Benefits**:
- Single path operation instead of multiple
- Smooth curves with proper line joins
- Better performance for long strokes

### 2. Event Throttling

**Cursor Updates**
```javascript
const now = Date.now();
if (now - this.lastCursorSend >= this.cursorThrottle) {
  this.send({ type: 'cursor', cursor: cursor });
  this.lastCursorSend = now;
}
```

**Rationale**:
- Mouse move events fire at ~100Hz
- Network can't handle that rate
- 20Hz (50ms throttle) is smooth enough for cursor tracking
- Reduces server load by 80%

### 3. Stroke Transmission Strategy

**Decision**: Send complete strokes, not individual points

**Alternatives Considered**:

| Strategy | Pros | Cons | Chosen |
|----------|------|------|--------|
| Send each point | Real-time feel | High bandwidth, complex state | ❌ |
| Send complete stroke | Low bandwidth, simple | Slight delay | ✅ |
| Batch points | Balance | Complex implementation | ❌ |

### 4. History Limit

**Implementation**:
```javascript
if (this.operations.length > this.maxOperations) {
  this.operations.shift();
  this.currentIndex--;
}
```

**Rationale**:
- Prevents unbounded memory growth
- 1000 operations ≈ 5-10 minutes of active drawing
- Oldest operations are least likely to be undone
- Can be increased for production use

### 5. Reconnection Strategy

**Exponential Backoff**:
```javascript
const delay = this.reconnectDelay * Math.pow(2, attempts - 1);
// 1s, 2s, 4s, 8s, 16s
```

**Benefits**:
- Reduces server load during outages
- Gives network time to recover
- Prevents thundering herd problem

---

## Conflict Resolution

### Types of Conflicts

#### 1. Simultaneous Drawing
**Scenario**: Two users draw overlapping strokes

**Resolution**:
- Server receives both strokes
- Both added to operation history in arrival order
- All clients render in same order
- **Result**: Consistent state across all clients

#### 2. Undo During Active Drawing
**Scenario**: User A is drawing, User B undoes

**Resolution**:
- User A's stroke completes and is added to history
- User B's undo removes the last operation (might be A's stroke)
- All clients redraw from updated history
- **Result**: Last operation is removed, regardless of who drew it

#### 3. Network Latency
**Scenario**: Operations arrive out of order due to network delays

**Resolution**:
- Server processes operations in arrival order
- Timestamps are recorded but not used for ordering
- **Result**: Server order is authoritative

#### 4. Disconnection During Drawing
**Scenario**: User loses connection mid-stroke

**Resolution**:
- Incomplete stroke is not sent to server
- User's cursor disappears for other users
- On reconnect, user gets current canvas state
- **Result**: Incomplete stroke is lost (acceptable trade-off)

### Design Philosophy

**Server as Single Source of Truth**
- All state changes go through server
- Server broadcasts authoritative state
- Clients are "dumb terminals" that render server state
- Eliminates entire classes of synchronization bugs

**Trade-offs**:
- ✅ Simple, predictable behavior
- ✅ Easy to reason about
- ✅ Guaranteed consistency
- ❌ Requires server round-trip for all operations
- ❌ Not suitable for offline mode

---

## State Management

### Client State

**Canvas State**
```javascript
{
  isDrawing: boolean,
  currentTool: 'brush' | 'eraser',
  currentColor: string,
  currentStrokeWidth: number,
  currentStroke: {
    tool: string,
    color: string,
    width: number,
    points: Array<{x, y}>
  }
}
```

**Connection State**
```javascript
{
  userId: string,
  currentUser: {
    id: string,
    name: string,
    color: string
  },
  users: Map<userId, user>,
  remoteCursors: Map<userId, DOMElement>
}
```

### Server State

**Room State**
```javascript
{
  id: string,
  users: Map<userId, {
    id: string,
    ws: WebSocket,
    name: string,
    color: string,
    cursor: {x, y}
  }>,
  drawingState: DrawingState,
  createdAt: timestamp
}
```

**Drawing State**
```javascript
{
  operations: Array<Operation>,
  currentIndex: number,
  maxOperations: number
}
```

### State Synchronization

**On User Join**:
1. Server sends complete operation history
2. Client redraws entire canvas
3. Client is now in sync

**On Drawing**:
1. Client draws locally (optimistic update)
2. Client sends stroke to server
3. Server adds to history
4. Server broadcasts to other clients
5. Other clients draw the stroke

**On Undo/Redo**:
1. Client sends request
2. Server updates history index
3. Server sends updated operation list
4. All clients redraw from scratch
5. All clients are now in sync

---

## Scalability Considerations

### Current Limitations

**Memory**:
- Each room stores full operation history
- 1000 operations × ~1KB each = ~1MB per room
- 100 concurrent rooms = ~100MB

**Network**:
- Each drawing operation broadcast to all users in room
- N users = N-1 broadcasts per operation
- Bandwidth scales with O(N²)

**CPU**:
- Canvas redraw on every undo/redo
- Scales with number of operations
- Typical: 1000 operations = ~50ms redraw

### Scaling Strategies

**For 100+ concurrent users**:
1. Implement operation history pagination
2. Add Redis for distributed state
3. Use WebSocket clustering
4. Implement canvas state compression
5. Add CDN for static assets

**For 1000+ concurrent users**:
1. Shard rooms across multiple servers
2. Implement CRDT-based synchronization
3. Add database persistence
4. Use message queue for operations
5. Implement canvas tile-based rendering

---

## Security Considerations

### Current Implementation

**⚠️ This is a demonstration project. Production use requires:**

1. **Authentication**: Add user authentication system
2. **Authorization**: Implement room access controls
3. **Rate Limiting**: Prevent spam and DoS attacks
4. **Input Validation**: Sanitize all user inputs
5. **HTTPS/WSS**: Use secure connections
6. **CORS**: Configure appropriate CORS policies

### Potential Vulnerabilities

1. **DoS via rapid operations**: No rate limiting
2. **Memory exhaustion**: No per-user limits
3. **XSS**: No input sanitization (low risk with canvas)
4. **Room hijacking**: No authentication

---

## Testing Strategy

### Unit Tests (Recommended)
- DrawingState operations
- RoomManager user management
- WebSocket message serialization

### Integration Tests (Recommended)
- End-to-end drawing flow
- Undo/redo across multiple clients
- Reconnection handling

### Load Tests (Recommended)
- 10+ concurrent users
- Rapid drawing operations
- Network interruption scenarios

---

## Conclusion

This architecture prioritizes:
1. **Simplicity**: Easy to understand and maintain
2. **Consistency**: Guaranteed state synchronization
3. **Real-time Feel**: Smooth collaborative experience
4. **Extensibility**: Easy to add features

Trade-offs made:
- Server round-trip for all operations (vs. optimistic updates)
- Full canvas redraw on undo/redo (vs. incremental updates)
- Global undo (vs. per-user undo)

These trade-offs are appropriate for the target use case (small collaborative groups) and can be revisited for different requirements.
