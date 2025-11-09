/**
 * Canvas Drawing Manager
 * Handles all canvas drawing operations and state management
 */

class CanvasManager {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: false });
    
    // Drawing state
    this.isDrawing = false;
    this.currentTool = 'brush';
    this.currentColor = '#000000';
    this.currentStrokeWidth = 4;
    
    // Current stroke data
    this.currentStroke = null;
    
    // Performance optimization
    this.lastPoint = null;
    this.strokeBuffer = [];
    this.bufferTimeout = null;
    
    // Initialize canvas size
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    
    // Setup canvas properties
    this.setupCanvas();
  }

  /**
   * Setup canvas rendering properties
   */
  setupCanvas() {
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  /**
   * Resize canvas to fit container
   */
  resizeCanvas() {
    const container = this.canvas.parentElement;
    const rect = container.getBoundingClientRect();
    
    // Store current canvas content
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    
    // Resize canvas
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    
    // Restore canvas content
    this.ctx.putImageData(imageData, 0, 0);
    
    // Reapply canvas properties
    this.setupCanvas();
  }

  /**
   * Start drawing
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   */
  startDrawing(x, y) {
    this.isDrawing = true;
    this.lastPoint = { x, y };
    
    // Initialize current stroke
    this.currentStroke = {
      tool: this.currentTool,
      color: this.currentColor,
      width: this.currentStrokeWidth,
      points: [{ x, y }]
    };
    
    // Start path
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
  }

  /**
   * Continue drawing
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {Object|null} Point data if stroke should be sent
   */
  draw(x, y) {
    if (!this.isDrawing) return null;
    
    // Add point to current stroke
    this.currentStroke.points.push({ x, y });
    
    // Draw line segment
    this.drawLine(
      this.lastPoint.x,
      this.lastPoint.y,
      x,
      y,
      this.currentColor,
      this.currentStrokeWidth,
      this.currentTool
    );
    
    this.lastPoint = { x, y };
    
    // Return point for network transmission (throttled)
    return { x, y };
  }

  /**
   * Stop drawing
   * @returns {Object|null} Complete stroke data
   */
  stopDrawing() {
    if (!this.isDrawing) return null;
    
    this.isDrawing = false;
    const stroke = this.currentStroke;
    this.currentStroke = null;
    this.lastPoint = null;
    
    return stroke;
  }

  /**
   * Draw a line segment
   * @param {number} x1 - Start X
   * @param {number} y1 - Start Y
   * @param {number} x2 - End X
   * @param {number} y2 - End Y
   * @param {string} color - Stroke color
   * @param {number} width - Stroke width
   * @param {string} tool - Tool type
   */
  drawLine(x1, y1, x2, y2, color, width, tool) {
    this.ctx.save();
    
    if (tool === 'eraser') {
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.strokeStyle = color;
    }
    
    this.ctx.lineWidth = width;
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
    
    this.ctx.restore();
  }

  /**
   * Draw a complete stroke (for remote users or undo/redo)
   * @param {Object} stroke - Stroke data
   */
  drawStroke(stroke) {
    if (!stroke || !stroke.points || stroke.points.length === 0) return;
    
    this.ctx.save();
    
    if (stroke.tool === 'eraser') {
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.strokeStyle = stroke.color;
    }
    
    this.ctx.lineWidth = stroke.width;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    
    this.ctx.beginPath();
    this.ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    
    for (let i = 1; i < stroke.points.length; i++) {
      this.ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    
    this.ctx.stroke();
    this.ctx.restore();
  }

  /**
   * Draw remote user's stroke in real-time
   * @param {Object} point - Point data
   * @param {Object} strokeData - Stroke metadata
   */
  drawRemotePoint(point, strokeData) {
    if (!strokeData.lastPoint) {
      strokeData.lastPoint = point;
      return;
    }
    
    this.drawLine(
      strokeData.lastPoint.x,
      strokeData.lastPoint.y,
      point.x,
      point.y,
      strokeData.color,
      strokeData.width,
      strokeData.tool
    );
    
    strokeData.lastPoint = point;
  }

  /**
   * Clear the entire canvas
   */
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Redraw canvas from operation history
   * @param {Array} operations - Array of operations
   */
  redrawFromHistory(operations) {
    this.clear();
    
    operations.forEach(operation => {
      if (operation.type === 'draw' && operation.data) {
        this.drawStroke(operation.data);
      }
    });
  }

  /**
   * Set current tool
   * @param {string} tool - Tool name
   */
  setTool(tool) {
    this.currentTool = tool;
    
    // Update cursor style
    if (tool === 'eraser') {
      this.canvas.style.cursor = 'crosshair';
    } else {
      this.canvas.style.cursor = 'crosshair';
    }
  }

  /**
   * Set current color
   * @param {string} color - Color hex code
   */
  setColor(color) {
    this.currentColor = color;
  }

  /**
   * Set stroke width
   * @param {number} width - Stroke width
   */
  setStrokeWidth(width) {
    this.currentStrokeWidth = width;
  }

  /**
   * Get canvas coordinates from mouse/touch event
   * @param {Event} event - Mouse or touch event
   * @returns {Object} Coordinates {x, y}
   */
  getCoordinates(event) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    
    let clientX, clientY;
    
    if (event.touches && event.touches.length > 0) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  /**
   * Get current drawing state
   * @returns {Object} Current state
   */
  getState() {
    return {
      tool: this.currentTool,
      color: this.currentColor,
      width: this.currentStrokeWidth
    };
  }
}
